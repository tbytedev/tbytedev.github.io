var g_AllowLocalStorage = false;

function IsLocalStorageAvailable()
{
	if (typeof localStorage !== "undefined")
	{
		try
		{
			localStorage.setItem("LocalStorageTest", "true");
			if (localStorage.getItem("LocalStorageTest") === "true")
			{
				localStorage.removeItem("LocalStorageTest");
				return true;
			}
		}
		catch(e)
		{
		}
	}
	return false;
}

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
	localStorage.setItem("LocalStorageEnabled", "true");
	HideEULaw();
}

function Init()
{
	if (true === IsLocalStorageAvailable())
	{
		if (localStorage.getItem("LocalStorageEnabled") === "true")
			g_AllowLocalStorage = true;
		else
			ShowEULaw();
	}
}