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

var g_AllowLocalStorage = false;
var g_LocalStorage = new ProtoStorage(localStorage);
var g_SessionStorage = new ProtoStorage(sessionStorage);
var g_GLContext = null;


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

function OnLoad()
{
	if (g_LocalStorage.IsAvailable())
	{
		if (g_LocalStorage.GetItem("LocalStorageEnabled") === "true")
			g_AllowLocalStorage = true;
		else if ( "true" !== g_SessionStorage.GetItem("LocalStorageAnswered"))
			ShowEULaw();
	}

	var render_canvas = document.getElementById("render_canvas");
	g_GLContext = render_canvas.getContext("webgl");
	if (null === g_GLContext)
		return;

	g_GLContext.clearColor(0.0, 0.0, 0.0, 1.0);
	g_GLContext.clear(g_GLContext.COLOR_BUFFER_BIT);
}

function OnTexture0Load(event)
{
	var draw_area = document.getElementById("draw_area");
	var render_canvas = document.getElementById("render_canvas");
	var tex = event.currentTarget;
	if (draw_area.clientWidth * tex.naturalHeight > draw_area.clientHeight * tex.naturalWidth)
	{
		render_canvas.style.height = "100%";
		render_canvas.style.width = String(tex.naturalWidth * draw_area.clientHeight / tex.naturalHeight) + "px";
	}
	else
	{
		render_canvas.style.height = String(tex.naturalHeight * draw_area.clientWidth / tex.naturalWidth) + "%";
		render_canvas.style.width = "100%";
	}
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