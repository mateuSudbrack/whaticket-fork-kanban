function getConfig(names, defaultValue = null) {
  const keys = Array.isArray(names) ? names : [names];

  // If inside a docker container, use window.ENV
  if (window.ENV !== undefined) {
    for (const key of keys) {
      if (window.ENV[key] !== undefined) {
        return window.ENV[key];
      }
    }
  }

  for (const key of keys) {
    if (import.meta.env[key] !== undefined) {
      return import.meta.env[key];
    }
  }

  return defaultValue;
}

export function getBackendUrl() {
  return getConfig(["REACT_APP_BACKEND_URL", "VITE_BACKEND_URL"]);
}

export function getBackendSocketUrl() {
  return getConfig(
    ["REACT_APP_BACKEND_SOCKET_URL", "VITE_BACKEND_SOCKET_URL"],
    getBackendUrl()
  );
}

export function getBackendSocketPath() {
  return getConfig(
    ["REACT_APP_BACKEND_SOCKET_PATH", "VITE_BACKEND_SOCKET_PATH"],
    "/socket.io"
  );
}

export function getHoursCloseTicketsAuto() {
  return getConfig([
    "REACT_APP_HOURS_CLOSE_TICKETS_AUTO",
    "VITE_HOURS_CLOSE_TICKETS_AUTO"
  ]);
}
