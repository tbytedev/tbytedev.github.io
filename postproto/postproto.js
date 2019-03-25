"use strict";

var g_AllowLocalStorage = false;
var g_RenderCanvas = null;
var g_GL = null;
var g_RenderCanvasRect = null;
var g_FrameBufferTexture = null;
var g_FrameBuffer = null;
var g_VertexBuffer = null;

var g_PreviewTexture = null;

var g_PreviewProgram = null;
var g_PreviewUniformBuffer = null;
var g_PreviewUniformBufferLocation = null;
var g_PreviewTextureLocation = null;

var g_ZoomProgram = null;
var g_ZoomUniformBuffer = null;
var g_ZoomUniformBufferLocation = null;
var g_ZoomTextureLocation = null;
var g_Image = null;

var g_DrawAreaWidth = 0;
var g_DrawAreaHeight = 0;
var g_Gap = 0;
var g_PreviewViewportWidth = 0;
var g_PreviewViewportHeight = 0;
var g_PreviewHorizontalScale = 0;
var g_PreviewVerticalScale = 0;
var g_PreviewVerticalOffset = 0;

const g_VertexShaderSource = `#version 300 es
in vec2 i_VertexPosition;
void main()
{
	gl_Position = vec4(i_VertexPosition, 0.0, 1.0);
}
`

const g_PreviewFragmentShaderSource = `#version 300 es
out mediump vec4 g_Output;
uniform u_Buffer
{
	highp float PreviewHorizontalScale;
	highp float PreviewVerticalScale;
	highp int   PreviewVerticalOffset;
};
uniform sampler2D u_Sampler;
void main()
{
	highp ivec2 itexcoord;
	itexcoord.x = int(PreviewHorizontalScale * gl_FragCoord.x);
	itexcoord.y = int(PreviewVerticalScale   * gl_FragCoord.y) + PreviewVerticalOffset;
	g_Output = texelFetch(u_Sampler, itexcoord, 0);
}
`

const g_ZoomFragmentShaderSource = `#version 300 es
out mediump vec4 g_Output;
uniform u_Buffer
{
	highp float TexcoordFactor;
	highp float RendertargetHeight;
	highp float ViewportHeight;
};
uniform sampler2D u_Sampler;
void main()
{
	highp ivec2 itexture_size = textureSize(u_Sampler, 0);
	highp ivec2 itexcoord;
	itexcoord.x = int(TexcoordFactor * gl_FragCoord.x);
	itexcoord.y = itexture_size.y - 1 - int(TexcoordFactor * (gl_FragCoord.y - RendertargetHeight + ViewportHeight));
	if (itexcoord.x >= itexture_size.x || itexcoord.y < 0)
		discard;
	g_Output = texelFetch(u_Sampler, itexcoord, 0);
}
`

const g_VertexData = new Float32Array
([
	-1.0, -1.0,
	3.0, -1.0,
	-1.0, 3.0
]);

if ("loading" === document.readyState)
	document.addEventListener("DOMContentLoaded", OnDOMContentLoad);
else
	OnDOMContentLoad();

class ProtoStorage
{
	constructor(storage)
	{
		this.Available = false;
		if (typeof storage !== "undefined")
		{
			try
			{
				storage.setItem("StorageTest", "true");
				if (storage.getItem("StorageTest") === "true")
				{
					storage.removeItem("StorageTest");
					this.Available = true;
				}
			}
			catch(e)
			{}
		}

		if (this.Available)
			this.Storage = storage;
	}

	SetItem(key_name, key_value)
	{
		if (!this.Available)
			return;

		try
		{
			this.Storage.setItem(key_name, key_value);
		}
		catch(e)
		{}
	}

	GetItem(key_name)
	{
		if (!this.Available)
			return null;

		return this.Storage.getItem(key_name);
	}

	IsAvailable()
	{
		return this.Available;
	}
}

var g_LocalStorage = new ProtoStorage(localStorage);
var g_SessionStorage = new ProtoStorage(sessionStorage);

function ShowEULaw()
{
	var eulaw_div = document.getElementById("eulaw");
	eulaw_div.style.height = String(eulaw_div.scrollHeight) + "px";
}

function HideEULaw()
{
	var eulaw_div = document.getElementById("eulaw");
	eulaw_div.style.height = "0px";
}

function OnAllowLocalStorage()
{
	g_LocalStorage.SetItem("LocalStorageEnabled", "true");
	g_SessionStorage.SetItem("LocalStorageAnswered", "true");
	HideEULaw();
	g_AllowLocalStorage = true;
}

function OnRefuseLocalStorage()
{
	g_SessionStorage.SetItem("LocalStorageAnswered", "true");
	HideEULaw();
}

function AttachShader(program, type, source)
{
	var shader = g_GL.createShader(type);
	g_GL.shaderSource(shader, source);
	g_GL.compileShader(shader);
	if (!g_GL.getShaderParameter(shader, g_GL.COMPILE_STATUS))
	{
		console.log(`Error compiling ${g_GL.VERTEX_SHADER === type ? "vertex" : "fragment"} shader:`);
		console.log(g_GL.getShaderInfoLog(shader));
		return;
	}
	g_GL.attachShader(program, shader);
}

function CreateProgram(vertex_shader_source, fragment_shader_source)
{
	var program = g_GL.createProgram();
	AttachShader(program, g_GL.VERTEX_SHADER, vertex_shader_source);
	AttachShader(program, g_GL.FRAGMENT_SHADER, fragment_shader_source);
	g_GL.linkProgram(program);

	if (!g_GL.getProgramParameter(program, g_GL.LINK_STATUS))
	{
		console.log("Error linking shader program:");
		console.log(g_GL.getProgramInfoLog(program));
	}

	return program;
}

function OnDOMContentLoad()
{
	g_RenderCanvas = document.getElementById("render_canvas");
	g_RenderCanvas.addEventListener("mousemove", OnMouseMove);
	g_GL = g_RenderCanvas.getContext("webgl2", {preserveDrawingBuffer: true});
	if (null === g_GL)
		return;

	g_FrameBufferTexture = g_GL.createTexture();
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_FrameBufferTexture);
	g_FrameBuffer = g_GL.createFramebuffer();
	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, g_FrameBuffer);
	g_GL.framebufferTexture2D(g_GL.FRAMEBUFFER, g_GL.COLOR_ATTACHMENT0, g_GL.TEXTURE_2D, g_FrameBufferTexture, 0);

	g_PreviewProgram = CreateProgram(g_VertexShaderSource, g_PreviewFragmentShaderSource);

	g_VertexBuffer = g_GL.createBuffer();
	g_GL.bindBuffer(g_GL.ARRAY_BUFFER, g_VertexBuffer);
	g_GL.bufferData(g_GL.ARRAY_BUFFER, g_VertexData, g_GL.STATIC_DRAW);
	var position_location = g_GL.getAttribLocation(g_PreviewProgram, "i_VertexPosition");
	g_GL.enableVertexAttribArray(position_location);
	g_GL.vertexAttribPointer(position_location, 2, g_GL.FLOAT, false, 0, 0);

	g_PreviewTextureLocation = g_GL.getUniformLocation(g_PreviewProgram, "u_Sampler");
	g_PreviewTexture = g_GL.createTexture();

	g_PreviewUniformBufferLocation = g_GL.getUniformBlockIndex(g_PreviewProgram, "u_Buffer");
	g_PreviewUniformBuffer = g_GL.createBuffer();
	g_GL.uniformBlockBinding(g_PreviewProgram, g_PreviewUniformBufferLocation, 0);

	g_ZoomProgram = CreateProgram(g_VertexShaderSource, g_ZoomFragmentShaderSource);

	g_ZoomUniformBufferLocation = g_GL.getUniformBlockIndex(g_ZoomProgram, "u_Buffer");
	g_ZoomUniformBuffer = g_GL.createBuffer();
	g_GL.uniformBlockBinding(g_ZoomProgram, g_ZoomUniformBufferLocation, 0);

	g_ZoomTextureLocation = g_GL.getUniformLocation(g_ZoomProgram, "u_Sampler");

	SetCanvasBuffer();
	SetPreviewUniformData();
}

function OnLoad()
{
	if (g_LocalStorage.IsAvailable())
	{
		if (g_LocalStorage.GetItem("LocalStorageEnabled") === "true")
			g_AllowLocalStorage = true;
		else if ( "true" !== g_SessionStorage.GetItem("LocalStorageAnswered"))
			ShowEULaw();
	}
}

function OnResize()
{
	SetCanvasBuffer();
	SetPreviewUniformData();
	RenderPreview();
}

function SetCanvasBuffer()
{
	if (g_RenderCanvas.width != g_RenderCanvas.clientWidth)
		g_RenderCanvas.width = g_RenderCanvas.clientWidth;
	if (g_RenderCanvas.height != g_RenderCanvas.clientHeight)
		g_RenderCanvas.height = g_RenderCanvas.clientHeight;

	g_RenderCanvasRect = g_RenderCanvas.getBoundingClientRect();

	g_DrawAreaWidth = g_RenderCanvas.width;
	if (0 === (g_RenderCanvas.height & 1))
		g_Gap = 6;
	else
		g_Gap = 7;
	g_DrawAreaHeight = (g_RenderCanvas.height - g_Gap) / 2;

	if (null === g_Image)
		return;

	g_PreviewHorizontalScale = g_Image.naturalWidth  / g_DrawAreaWidth;
	g_PreviewVerticalScale   = g_Image.naturalHeight / g_DrawAreaHeight;
	if (g_PreviewHorizontalScale > g_PreviewVerticalScale)
	{
		g_PreviewViewportWidth = g_DrawAreaWidth;
		g_PreviewViewportHeight = Math.round(g_Image.naturalHeight / g_PreviewHorizontalScale);
		g_PreviewVerticalScale = g_Image.naturalHeight / g_PreviewViewportHeight;
	}
	else
	{
		g_PreviewViewportWidth = Math.round(g_Image.naturalWidth / g_PreviewVerticalScale);
		g_PreviewViewportHeight = g_DrawAreaHeight;
		g_PreviewHorizontalScale = g_Image.naturalWidth / g_PreviewViewportWidth;
	}
	g_PreviewVerticalOffset = (g_PreviewViewportHeight - g_RenderCanvas.height) * g_PreviewVerticalScale;
}

function SetPreviewUniformData()
{
	if (null === g_Image)
		return;

	const uniform_data = new ArrayBuffer(16);
	const data_view = new DataView(uniform_data);
	data_view.setFloat32(0,  g_PreviewHorizontalScale, true);
	data_view.setFloat32(4,  g_PreviewVerticalScale,   true);
	data_view.setInt32  (8,  g_PreviewVerticalOffset,  true);
	g_GL.bindBuffer(g_GL.UNIFORM_BUFFER, g_PreviewUniformBuffer);
	g_GL.bufferData(g_GL.UNIFORM_BUFFER, uniform_data, g_GL.STATIC_DRAW);
	g_GL.bindBufferBase(g_GL.UNIFORM_BUFFER, 0, g_PreviewUniformBuffer);
}

function SetZoomUniformData(mouse_x, mouse_y)
{
	if (null === g_Image)
		return;

	var texcoord_factor = Math.max(g_Image.naturalWidth / g_DrawAreaWidth, g_Image.naturalHeight / g_DrawAreaHeight);
	const uniform_data = new ArrayBuffer(16);
	const data_view = new DataView(uniform_data);
	data_view.setFloat32(0, texcoord_factor, true);
	data_view.setFloat32(4, g_RenderCanvas.height, true);
	data_view.setFloat32(8, g_DrawAreaHeight, true);
	g_GL.bindBuffer(g_GL.UNIFORM_BUFFER, g_ZoomUniformBuffer);
	g_GL.bufferData(g_GL.UNIFORM_BUFFER, uniform_data, g_GL.STATIC_DRAW);
	g_GL.bindBufferBase(g_GL.UNIFORM_BUFFER, 0, g_ZoomUniformBuffer);
}

function RenderPreview()
{
	// Test only
	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, g_FrameBuffer);
	g_GL.clearColor(0, 0, 1, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, null);
	g_GL.clearColor(1, 1, 0, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.viewport(0, g_RenderCanvas.height - g_PreviewViewportHeight, g_PreviewViewportWidth, g_PreviewViewportHeight);

	g_GL.useProgram(g_PreviewProgram);

	g_GL.activeTexture(g_GL.TEXTURE0);
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_PreviewTexture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, g_Image.naturalWidth, g_Image.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, g_Image);

	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_S, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_T, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_MIN_FILTER, g_GL.NEAREST);
	g_GL.uniform1i(g_PreviewTextureLocation, 0);

	g_GL.drawArrays(g_GL.TRIANGLES, 0, 3);
}

function RenderZoom()
{
	g_GL.viewport(0, 0, g_DrawAreaWidth, g_DrawAreaHeight);

	g_GL.useProgram(g_ZoomProgram);

	g_GL.activeTexture(g_GL.TEXTURE0);
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_PreviewTexture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, g_Image.naturalWidth, g_Image.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, g_Image);

	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_S, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_T, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_MIN_FILTER, g_GL.NEAREST);
	g_GL.uniform1i(g_ZoomTextureLocation, 0);

	g_GL.drawArrays(g_GL.TRIANGLES, 0, 3);
}

function OnMouseMove(event)
{
	if (null === g_RenderCanvas)
		return;

	var mouse_x = event.clientX - g_RenderCanvasRect.left;
	var mouse_y = event.clientY - g_RenderCanvasRect.top;

	SetZoomUniformData(mouse_x, mouse_y);
	RenderZoom();
}

function OnTexture0Load(event)
{
	if (null === g_GL)
		return;

	g_Image = event.currentTarget;

	g_GL.bindTexture(g_GL.TEXTURE_2D, g_FrameBufferTexture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, g_Image.naturalWidth, g_Image.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, null);

	SetCanvasBuffer();
	SetPreviewUniformData();
	RenderPreview();
}

function OnChangeTexture(event, id)
{
	var file_reader = new FileReader;

	file_reader.onload = function()
	{
		var temp_imgage = new Image;
	
		temp_imgage.onload = function()
		{
			var image = document.getElementById(id);
			if (temp_imgage.width >temp_imgage.height)
			{
				image.style.width = "100%";
				image.style.height = String(100 * temp_imgage.height / temp_imgage.width) + "%";
			}
			else
			{
				image.style.height = "100%";
				image.style.width = String(100 * temp_imgage.width / temp_imgage.height) + "%";
			}
			image.src = file_reader.result;
		};
	
		temp_imgage.src = file_reader.result;
	};
	
	file_reader.readAsDataURL(event.target.files[0]);
}