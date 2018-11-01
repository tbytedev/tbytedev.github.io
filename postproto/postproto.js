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
}
