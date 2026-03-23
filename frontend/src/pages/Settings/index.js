import React, { useState, useEffect } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Container from "@material-ui/core/Container";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		alignItems: "center",
		padding: theme.spacing(8, 8, 3),
	},

	paper: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		marginBottom: 12,

	},

	settingOption: {
		marginLeft: "auto",
	},
	margin: {
		margin: theme.spacing(1),
	},

}));

const Settings = () => {
	const classes = useStyles();

	const [settings, setSettings] = useState([]);
	const [textSettings, setTextSettings] = useState({
		closeOpenTicketsAfterHours: "0",
	});

	const defaultSettingValues = {
		userCreation: "enabled",
		userApiToken: "",
		closeOpenTicketsAfterHours: "0",
	};

	useEffect(() => {
		const fetchSession = async () => {
			try {
				const { data } = await api.get("/settings");
				setSettings(data);
				setTextSettings({
					closeOpenTicketsAfterHours:
						data.find(s => s.key === "closeOpenTicketsAfterHours")?.value || "0",
				});
			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", data => {
			if (data.action === "update") {
				setSettings(prevState => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex(s => s.key === data.setting.key);
					if (settingIndex !== -1) {
						aux[settingIndex].value = data.setting.value;
					} else {
						aux.push(data.setting);
					}
					return aux;
				});
				if (data.setting.key === "closeOpenTicketsAfterHours") {
					setTextSettings(prevState => ({
						...prevState,
						closeOpenTicketsAfterHours: data.setting.value || "0",
					}));
				}
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleChangeSetting = async e => {
		const selectedValue = e.target.value;
		const settingKey = e.target.name;

		try {
			await api.put(`/settings/${settingKey}`, {
				value: selectedValue,
			});
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const handleTextSettingChange = e => {
		const { name, value } = e.target;
		setTextSettings(prevState => ({
			...prevState,
			[name]: value,
		}));
	};

	const handleBlurTextSetting = async e => {
		const settingKey = e.target.name;
		const normalizedValue = String(Math.max(0, Number(e.target.value || 0)));

		setTextSettings(prevState => ({
			...prevState,
			[settingKey]: normalizedValue,
		}));

		if (normalizedValue === getSettingValue(settingKey)) {
			return;
		}

		try {
			await api.put(`/settings/${settingKey}`, {
				value: normalizedValue,
			});
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const getSettingValue = key => {
		return settings.find(s => s.key === key)?.value || defaultSettingValues[key] || "";
	};

	return (
		<div className={classes.root}>
			<Container className={classes.container} maxWidth="sm">
				<Typography variant="body2" gutterBottom>
					{i18n.t("settings.title")}
				</Typography>
				<Paper className={classes.paper}>
					<Typography variant="body1">
						{i18n.t("settings.settings.userCreation.name")}
					</Typography>
					<Select
						margin="dense"
						variant="outlined"
						native
						id="userCreation-setting"
						name="userCreation"
						value={getSettingValue("userCreation")}
						className={classes.settingOption}
						onChange={handleChangeSetting}
					>
						<option value="enabled">
							{i18n.t("settings.settings.userCreation.options.enabled")}
						</option>
						<option value="disabled">
							{i18n.t("settings.settings.userCreation.options.disabled")}
						</option>
					</Select>

				</Paper>

				<Paper className={classes.paper}>
					<Typography variant="body1">
						{i18n.t("settings.settings.closeOpenTicketsAfterHours.name")}
					</Typography>
					<TextField
						type="number"
						name="closeOpenTicketsAfterHours"
						margin="dense"
						variant="outlined"
						className={classes.settingOption}
						value={textSettings.closeOpenTicketsAfterHours}
						onChange={handleTextSettingChange}
						onBlur={handleBlurTextSetting}
						inputProps={{ min: 0, step: 1 }}
						helperText={i18n.t("settings.settings.closeOpenTicketsAfterHours.help")}
					/>
				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="api-token-setting"
						InputProps={{ readOnly: true }}
						label="Token Api"
						margin="dense"
						variant="outlined"
						fullWidth
						value={getSettingValue("userApiToken")}
					/>
				</Paper>

			</Container>
		</div>
	);
};

export default Settings;
