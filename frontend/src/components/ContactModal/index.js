import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	textField: {
		marginRight: theme.spacing(1),
		flex: 1,
	},

	extraAttr: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		gap: theme.spacing(1),
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
}));

const ContactSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email"),
});

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
	const classes = useStyles();
	const isMounted = useRef(true);

	const initialState = {
		name: "",
		number: "",
		email: "",
		extraInfo: [],
	};

	const [contact, setContact] = useState(initialState);
	const [fieldDefinitions, setFieldDefinitions] = useState([]);

	const mergeExtraInfo = (definitions, extraInfo = []) => {
		const mappedExtraInfo = extraInfo.reduce((acc, info) => {
			if (info.fieldDefinitionId) {
				acc[info.fieldDefinitionId] = info;
			}
			return acc;
		}, {});

		return definitions.map(definition => {
			const currentInfo = mappedExtraInfo[definition.id];

			return {
				id: currentInfo?.id,
				fieldDefinitionId: definition.id,
				name: definition.name,
				value: currentInfo?.value || "",
			};
		});
	};

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			try {
				const { data: definitions } = await api.get("/contact-field-definitions");
				if (isMounted.current) {
					setFieldDefinitions(definitions.filter(definition => definition.active));
				}

				if (initialValues) {
					setContact(prevState => {
						const nextState = { ...prevState, ...initialValues };
						return {
							...nextState,
							extraInfo: mergeExtraInfo(
								definitions.filter(definition => definition.active),
								initialValues.extraInfo
							),
						};
					});
				}

				if (!contactId) {
					if (isMounted.current && !initialValues) {
						setContact(prevState => ({
							...prevState,
							extraInfo: mergeExtraInfo(
								definitions.filter(definition => definition.active),
								[]
							),
						}));
					}
					return;
				}

				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact({
						...data,
						extraInfo: mergeExtraInfo(
							definitions.filter(definition => definition.active),
							data.extraInfo
						),
					});
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
	};

	const handleSaveContact = async values => {
		const payload = {
			...values,
			extraInfo: values.extraInfo.filter(info => info.value?.trim()),
		};

		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, payload);
				handleClose();
			} else {
				const { data } = await api.post("/contacts", payload);
				if (onSave) {
					onSave(data);
				}
				handleClose();
			}
			toast.success(i18n.t("contactModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<Dialog open={open} onClose={handleClose} maxWidth="lg" scroll="paper">
				<DialogTitle id="form-dialog-title">
					{contactId
						? `${i18n.t("contactModal.title.edit")}`
						: `${i18n.t("contactModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={contact}
					enableReinitialize={true}
					validationSchema={ContactSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveContact(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, errors, touched, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
								<Typography variant="subtitle1" gutterBottom>
									{i18n.t("contactModal.form.mainInfo")}
								</Typography>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.name")}
									name="name"
									autoFocus
									error={touched.name && Boolean(errors.name)}
									helperText={touched.name && errors.name}
									variant="outlined"
									margin="dense"
									className={classes.textField}
								/>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.number")}
									name="number"
									error={touched.number && Boolean(errors.number)}
									helperText={touched.number && errors.number}
									placeholder="5513912344321"
									variant="outlined"
									margin="dense"
								/>
								<div>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										placeholder="Email address"
										fullWidth
										margin="dense"
										variant="outlined"
									/>
								</div>
								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.extraInfo")}
								</Typography>

								{values.extraInfo && values.extraInfo.length > 0 ? (
									values.extraInfo.map((info, index) => (
										<div
											className={classes.extraAttr}
											key={`${info.fieldDefinitionId || index}-info`}
										>
											<TextField
												label="Campo"
												value={info.name}
												variant="outlined"
												margin="dense"
												className={classes.textField}
												InputProps={{ readOnly: true }}
											/>
											<Field
												as={TextField}
												label={i18n.t("contactModal.form.extraValue")}
												name={`extraInfo[${index}].value`}
												variant="outlined"
												margin="dense"
												className={classes.textField}
											/>
										</div>
									))
								) : (
									<Typography color="textSecondary">
										Nenhum campo global de contato foi definido.
									</Typography>
								)}
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("contactModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{contactId
										? `${i18n.t("contactModal.buttons.okEdit")}`
										: `${i18n.t("contactModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default ContactModal;
