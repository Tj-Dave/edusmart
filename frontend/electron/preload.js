const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("edusmartEnv", {
	offline: true,
});
