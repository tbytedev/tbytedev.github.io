"use strict";

var g_AllowLocalStorage = false;
var g_RenderCanvas = null;
var g_GL = null;
var g_RenderCanvasRect = null;
var g_ZoomCanvas = null;
var g_ZoomContext = null;
var g_FrameBufferTexture = null;
var g_FrameBuffer = null;
var g_VertexBuffer = null;
var g_UniformBuffer = null;
var g_UniformBufferLocation = null;
var g_Program = null;
var g_Texture = null;
var g_TextureLocation = null;
var g_Image = null;

const g_VertexShaderSource = `#version 300 es
in vec2 i_VertexPosition;
void main()
{
	gl_Position = vec4(i_VertexPosition, 0.0, 1.0);
}
`

const g_FragmentShaderSource = `#version 300 es
out mediump vec4 g_Output;
uniform u_Buffer
{
	highp float TexcoordFactor;
};
uniform sampler2D u_Sampler;
void main()
{
	highp ivec2 itexture_size = textureSize(u_Sampler, 0);
	highp ivec2 itexcoord;
	itexcoord.x = int(TexcoordFactor * gl_FragCoord.x);
	itexcoord.y = itexture_size.y - 1 - int(TexcoordFactor * gl_FragCoord.y);
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

function AttachShader(type, source)
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
	g_GL.attachShader(g_Program, shader);
}

function OnDOMContentLoad()
{
	g_RenderCanvas = document.getElementById("render_canvas");
	g_RenderCanvas.addEventListener("mousemove", OnMouseMove);
	g_GL = g_RenderCanvas.getContext("webgl2", {preserveDrawingBuffer: true});
	if (null === g_GL)
		return;

	g_ZoomCanvas = document.getElementById("zoom_canvas");
	g_ZoomContext = g_ZoomCanvas.getContext("2d");

	g_FrameBufferTexture = g_GL.createTexture();
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_FrameBufferTexture);
	g_FrameBuffer = g_GL.createFramebuffer();
	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, g_FrameBuffer);
	g_GL.framebufferTexture2D(g_GL.FRAMEBUFFER, g_GL.COLOR_ATTACHMENT0, g_GL.TEXTURE_2D, g_FrameBufferTexture, 0);

	g_Program = g_GL.createProgram();
	AttachShader(g_GL.VERTEX_SHADER, g_VertexShaderSource);
	AttachShader(g_GL.FRAGMENT_SHADER, g_FragmentShaderSource);
	g_GL.linkProgram(g_Program);

	if (!g_GL.getProgramParameter(g_Program, g_GL.LINK_STATUS))
	{
		console.log("Error linking shader program:");
		console.log(g_GL.getProgramInfoLog(g_Program));
	}
	g_GL.useProgram(g_Program);

	g_VertexBuffer = g_GL.createBuffer();
	g_GL.bindBuffer(g_GL.ARRAY_BUFFER, g_VertexBuffer);
	g_GL.bufferData(g_GL.ARRAY_BUFFER, g_VertexData, g_GL.STATIC_DRAW);

	g_UniformBuffer = g_GL.createBuffer();
	g_GL.uniformBlockBinding(g_Program, g_UniformBufferLocation, 0);

	g_Texture = g_GL.createTexture();

	g_TextureLocation = g_GL.getUniformLocation(g_Program, "u_Sampler");
	g_UniformBufferLocation = g_GL.getUniformBlockIndex(g_Program, "u_Sampler");

	g_GL.bindBuffer(g_GL.ARRAY_BUFFER, g_VertexBuffer);
	var position_location = g_GL.getAttribLocation(g_Program, "i_VertexPosition");
	g_GL.enableVertexAttribArray(position_location);
	g_GL.vertexAttribPointer(position_location, 2, g_GL.FLOAT, false, 0, 0);

	SetCanvasBuffer();
	SetUniformData();
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
	SetUniformData();
	Render();
}

function SetCanvasBuffer()
{
	if (g_RenderCanvas.width != g_RenderCanvas.clientWidth)
	{
		g_RenderCanvas.width = g_RenderCanvas.clientWidth;
		g_ZoomCanvas.width = g_RenderCanvas.clientWidth;
	}
	if (g_RenderCanvas.height != g_RenderCanvas.clientHeight)
	{
		g_RenderCanvas.height = g_RenderCanvas.clientHeight;
		g_ZoomCanvas.height = g_RenderCanvas.clientHeight;
	}

	g_RenderCanvasRect = g_RenderCanvas.getBoundingClientRect();

	if (null === g_GL)
		return;

	g_GL.viewport(0, 0, g_GL.drawingBufferWidth, g_GL.drawingBufferHeight);
}

function SetUniformData()
{
	if (null === g_Image)
		return;

	var texcoord_factor = Math.max(g_Image.naturalWidth / g_GL.drawingBufferWidth, g_Image.naturalHeight / g_GL.drawingBufferHeight);
	const uniform_data = new Float32Array([texcoord_factor, 0, 0, 0]);
	g_GL.bindBuffer(g_GL.UNIFORM_BUFFER, g_UniformBuffer);
	g_GL.bufferData(g_GL.UNIFORM_BUFFER, uniform_data, g_GL.STATIC_DRAW);
	g_GL.bindBufferBase(g_GL.UNIFORM_BUFFER, 0, g_UniformBuffer);
}

function Render()
{
	// Test only
	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, g_FrameBuffer);
	g_GL.clearColor(0, 0, 1, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, null);
	g_GL.clearColor(1, 1, 0, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.activeTexture(g_GL.TEXTURE0);
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_Texture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, g_Image.naturalWidth, g_Image.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, g_Image);

	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_S, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_T, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_MIN_FILTER, g_GL.NEAREST);
	g_GL.uniform1i(g_TextureLocation, 0);

	g_GL.drawArrays(g_GL.TRIANGLES, 0, 3);
}

function OnMouseMove(event)
{
	if (null === g_RenderCanvas)
		return;

	var mouse_x = event.clientX - g_RenderCanvasRect.left;
	var mouse_y = event.clientY - g_RenderCanvasRect.top;

	g_ZoomContext.imageSmoothingEnabled = false;
	g_ZoomContext.drawImage(g_RenderCanvas, mouse_x - 16, mouse_y - 16, 32, 32, 0, 0, g_RenderCanvas.width, g_RenderCanvas.height);
}

function OnTexture0Load(event)
{
	if (null === g_GL)
		return;

	g_Image = event.currentTarget;

	g_GL.bindTexture(g_GL.TEXTURE_2D, g_FrameBufferTexture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, g_Image.naturalWidth, g_Image.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, null);

	SetCanvasBuffer();
	SetUniformData();
	Render();
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