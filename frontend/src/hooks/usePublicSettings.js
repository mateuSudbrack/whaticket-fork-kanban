import { useEffect, useState } from "react";

import { getBackendUrl } from "../config";
import api from "../services/api";

export const DEFAULT_PUBLIC_SETTINGS = {
  appName: "Whaticket",
  appLogoUrl: "",
  mobileAppLatestVersion: "0.1.0",
  mobileAppDownloadUrl: "",
};

function mapSettings(items = []) {
  return items.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

export function getDefaultMobileDownloadUrl() {
  const backendUrl = String(getBackendUrl() || "").replace(/\/+$/, "");
  return backendUrl ? `${backendUrl}/public/whaticket-mobile.apk` : "";
}

export default function usePublicSettings() {
  const [settings, setSettings] = useState({
    ...DEFAULT_PUBLIC_SETTINGS,
    mobileAppDownloadUrl:
      DEFAULT_PUBLIC_SETTINGS.mobileAppDownloadUrl || getDefaultMobileDownloadUrl(),
  });

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const { data } = await api.get("/settings/public");

        if (!mounted) {
          return;
        }

        const mapped = mapSettings(data);

        setSettings({
          ...DEFAULT_PUBLIC_SETTINGS,
          ...mapped,
          mobileAppDownloadUrl:
            mapped.mobileAppDownloadUrl || getDefaultMobileDownloadUrl(),
        });
      } catch (_error) {}
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  return settings;
}
