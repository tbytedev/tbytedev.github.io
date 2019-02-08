"use strict";

var g_AllowLocalStorage = false;
var g_RenderCanvas = null;
var g_GL = null;
var g_FrameBufferTexture = null;
var g_FrameBuffer = null;
var g_VertexBuffer = null;
var g_Program = null;
var g_Texture = null;
var g_TextureLocation = null;

const g_VertexShaderSource = `#version 300 es
in vec2 i_VertexPosition;
void main()
{
	gl_Position = vec4(i_VertexPosition, 0.0, 1.0);
}
`

const g_FragmentShaderSource = `#version 300 es
precision highp int;
precision mediump float;
out vec4 g_Output;
uniform sampler2D u_Sampler;
void main()
{
	ivec2 itexture_size = textureSize(u_Sampler, 0);
	ivec2 itexcoord = ivec2(gl_FragCoord.xy);
	if (itexcoord.x >= itexture_size.x || itexcoord.y >= itexture_size.y)
		discard;
	g_Output = texelFetch(u_Sampler, itexcoord, 0);
}
`

const g_VertexData = new Float32Array
([
	-1.0, -1.0,
	1.0, -1.0,
	-1.0, 1.0
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
	g_GL = g_RenderCanvas.getContext("webgl2");
	if (null === g_GL)
		return;

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

	var position_location = g_GL.getAttribLocation(g_Program, "i_VertexPosition");

	var g_VertexBuffer = g_GL.createBuffer();
	g_GL.bindBuffer(g_GL.ARRAY_BUFFER, g_VertexBuffer);
	g_GL.bufferData(g_GL.ARRAY_BUFFER, g_VertexData, g_GL.STATIC_DRAW);

	g_Texture = g_GL.createTexture();

	g_TextureLocation = g_GL.getUniformLocation(g_Program, "uSampler");

	g_GL.useProgram(g_Program);
	g_GL.enableVertexAttribArray(position_location);
	g_GL.vertexAttribPointer(position_location, 2, g_GL.FLOAT, false, 0, 0);
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

function OnTexture0Load(event)
{
	if (null === g_FrameBufferTexture)
		return;
	
	if (g_RenderCanvas.width != g_RenderCanvas.clientWidth)
		g_RenderCanvas.width = g_RenderCanvas.clientWidth;
	if (g_RenderCanvas.height != g_RenderCanvas.clientHeight)
		g_RenderCanvas.height = g_RenderCanvas.clientHeight;

	g_GL.bindTexture(g_GL.TEXTURE_2D, g_FrameBufferTexture);

	var tex = event.currentTarget;
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, tex.naturalWidth, tex.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, null);

	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, g_FrameBuffer);
	g_GL.clearColor(0, 0, 1, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.bindFramebuffer(g_GL.FRAMEBUFFER, null);
	g_GL.clearColor(1, 1, 0, 1);
	g_GL.clear(g_GL.COLOR_BUFFER_BIT);

	g_GL.activeTexture(g_GL.TEXTURE0);
	g_GL.bindTexture(g_GL.TEXTURE_2D, g_Texture);
	g_GL.texImage2D(g_GL.TEXTURE_2D, 0, g_GL.RGBA, tex.naturalWidth, tex.naturalHeight, 0, g_GL.RGBA, g_GL.UNSIGNED_BYTE, tex);

	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_S, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_WRAP_T, g_GL.CLAMP_TO_EDGE);
	g_GL.texParameteri(g_GL.TEXTURE_2D, g_GL.TEXTURE_MIN_FILTER, g_GL.NEAREST);
	g_GL.uniform1i(g_TextureLocation, 0);

	g_GL.drawArrays(g_GL.TRIANGLES, 0, 3);
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