import { Op } from "sequelize";
import Setting from "../../models/Setting";
import { DEFAULT_SETTINGS } from "./defaultSettings";

const ListSettingsService = async (
  keys?: string[]
): Promise<Setting[] | undefined> => {
  const settings = await Setting.findAll({
    ...(keys ? { where: { key: { [Op.in]: keys } } } : {})
  });

  const missingDefaults = DEFAULT_SETTINGS.filter(
    setting =>
      (!keys || keys.includes(setting.key)) &&
      !settings.some(existingSetting => existingSetting.key === setting.key)
  ).map(setting => Setting.build(setting));

  return [...settings, ...missingDefaults];
};

export default ListSettingsService;
