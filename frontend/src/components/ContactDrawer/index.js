import React, { useEffect, useMemo, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";

import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import TagEditorDialog from "../TagEditorDialog";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
	drawer: {
		width: drawerWidth,
		flexShrink: 0,
	},
	drawerPaper: {
		width: drawerWidth,
		display: "flex",
		borderTop: "1px solid rgba(0, 0, 0, 0.12)",
		borderRight: "1px solid rgba(0, 0, 0, 0.12)",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		borderTopRightRadius: 4,
		borderBottomRightRadius: 4,
	},
	header: {
		display: "flex",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		backgroundColor: "#eee",
		alignItems: "center",
		padding: theme.spacing(0, 1),
		minHeight: "73px",
		justifyContent: "flex-start",
	},
	content: {
		display: "flex",
		backgroundColor: "#eee",
		flexDirection: "column",
		padding: "8px 0px 8px 8px",
		height: "100%",
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},

	contactAvatar: {
		margin: 15,
		width: 160,
		height: 160,
	},

	contactHeader: {
		display: "flex",
		padding: 8,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		"& > *": {
			margin: 4,
		},
	},

	contactDetails: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	tagsRow: {
		display: "flex",
		gap: theme.spacing(1),
		flexWrap: "wrap",
		marginTop: theme.spacing(1),
		marginBottom: theme.spacing(1),
	},
	contactExtraInfo: {
		marginTop: 4,
		padding: 6,
	},
	sectionCard: {
		marginTop: 8,
		padding: 10,
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	membershipRow: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		padding: 8,
		borderRadius: 10,
		border: "1px solid rgba(0, 0, 0, 0.12)",
		background: "#fafafa",
	},
	inlineRow: {
		display: "flex",
		gap: 8,
		alignItems: "center",
		flexWrap: "wrap",
	}
}));

const ContactDrawer = ({ open, handleDrawerClose, contact, loading, onContactUpdate }) => {
	const classes = useStyles();

	const [modalOpen, setModalOpen] = useState(false);
	const [pipelines, setPipelines] = useState([]);
	const [selectedPipelineId, setSelectedPipelineId] = useState("");
	const [selectedStageId, setSelectedStageId] = useState("");
	const [savingMembership, setSavingMembership] = useState(false);
	const [loadingCertificateFields, setLoadingCertificateFields] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		let mounted = true;

		const loadPipelines = async () => {
			try {
				const { data } = await api.get("/kanban-pipelines");
				if (!mounted) {
					return;
				}
				setPipelines(
					(data || []).filter(
						pipeline =>
							String(pipeline?.name || "").trim().toLowerCase() !== "pipeline principal"
					)
				);
			} catch (_error) {}
		};

		loadPipelines();

		return () => {
			mounted = false;
		};
	}, [open]);

	const selectedPipeline = useMemo(
		() => pipelines.find(item => String(item.id) === String(selectedPipelineId)) || null,
		[pipelines, selectedPipelineId]
	);

	const addablePipelines = useMemo(() => {
		const currentIds = new Set((contact?.pipelineMemberships || []).map(item => String(item.pipelineId)));
		return pipelines.filter(item => !currentIds.has(String(item.id)));
	}, [pipelines, contact]);

	const handleAddMembership = async () => {
		if (!contact?.id || !selectedPipelineId) {
			return;
		}

		setSavingMembership(true);
		try {
			const { data } = await api.post(`/contacts/${contact.id}/pipelines`, {
				pipelineId: Number(selectedPipelineId),
				kanbanStageId: selectedStageId ? Number(selectedStageId) : null,
			});
			if (onContactUpdate) {
				const nextMemberships = [...(contact.pipelineMemberships || []), data].sort(
					(a, b) => String(a.pipeline?.name || "").localeCompare(String(b.pipeline?.name || ""))
				);
				onContactUpdate({ ...contact, pipelineMemberships: nextMemberships });
			}
			setSelectedPipelineId("");
			setSelectedStageId("");
		} catch (_error) {}
		setSavingMembership(false);
	};

	const handleMoveMembership = async membership => {
		if (!contact?.id || !membership?.pipelineId || !membership?.kanbanStageId) {
			return;
		}

		setSavingMembership(true);
		try {
			const { data } = await api.put(
				`/contacts/${contact.id}/pipelines/${membership.pipelineId}`,
				{
					pipelineId: membership.pipelineId,
					kanbanStageId: membership.kanbanStageId,
				}
			);
			if (onContactUpdate) {
				onContactUpdate({
					...contact,
					pipelineMemberships: (contact.pipelineMemberships || []).map(item =>
						String(item.pipelineId) === String(membership.pipelineId) ? data : item
					),
				});
			}
		} catch (_error) {}
		setSavingMembership(false);
	};

	const handleRemoveMembership = async membership => {
		if (!contact?.id || !membership?.pipelineId) {
			return;
		}

		setSavingMembership(true);
		try {
			await api.delete(`/contacts/${contact.id}/pipelines/${membership.pipelineId}`);
			if (onContactUpdate) {
				onContactUpdate({
					...contact,
					pipelineMemberships: (contact.pipelineMemberships || []).filter(
						item => String(item.pipelineId) !== String(membership.pipelineId)
					),
				});
			}
		} catch (_error) {}
		setSavingMembership(false);
	};

	const handleLoadLatestCertificateFields = async () => {
		if (!contact?.id) {
			return;
		}

		setLoadingCertificateFields(true);
		try {
			const { data } = await api.post(`/contacts/${contact.id}/certificate-fields/load`);
			if (onContactUpdate && data?.contact) {
				onContactUpdate(data.contact);
			}
			toast.success(
				data?.order?.protocol
					? `Campos atualizados com o pedido ${data.order.protocol}`
					: "Campos atualizados com o ultimo pedido"
			);
		} catch (error) {
			toastError(error);
		}
		setLoadingCertificateFields(false);
	};

	return (
		<Drawer
			className={classes.drawer}
			variant="persistent"
			anchor="right"
			open={open}
			PaperProps={{ style: { position: "absolute" } }}
			BackdropProps={{ style: { position: "absolute" } }}
			ModalProps={{
				container: document.getElementById("drawer-container"),
				style: { position: "absolute" },
			}}
			classes={{
				paper: classes.drawerPaper,
			}}
		>
			<div className={classes.header}>
				<IconButton onClick={handleDrawerClose}>
					<CloseIcon />
				</IconButton>
				<Typography style={{ justifySelf: "center" }}>
					{i18n.t("contactDrawer.header")}
				</Typography>
			</div>
			{loading ? (
				<ContactDrawerSkeleton classes={classes} />
			) : (
				<div className={classes.content}>
					<Paper square variant="outlined" className={classes.contactHeader}>
						<Avatar
							alt={contact.name}
							src={contact.profilePicUrl}
							className={classes.contactAvatar}
						></Avatar>

						<Typography>{contact.name}</Typography>
						<Typography>
							<Link href={`tel:${contact.number}`}>{contact.number}</Link>
						</Typography>
						<Button
							variant="outlined"
							color="primary"
							onClick={() => setModalOpen(true)}
						>
							{i18n.t("contactDrawer.buttons.edit")}
						</Button>
						<TagEditorDialog
							entity={contact}
							entityType="contacts"
							title={`Etiquetas do contato ${contact.name}`}
							onUpdated={updatedContact => {
								if (onContactUpdate) {
									onContactUpdate(updatedContact);
								}
							}}
						/>
						<div className={classes.tagsRow}>
							{contact?.tags?.map(tag => (
								<Chip
									key={tag.id}
									size="small"
									label={tag.name}
									style={{ backgroundColor: tag.color, color: "#fff" }}
								/>
							))}
						</div>
					</Paper>
					<Paper square variant="outlined" className={classes.contactDetails}>
						<ContactModal
							open={modalOpen}
							onClose={() => setModalOpen(false)}
							contactId={contact.id}
						></ContactModal>
						<Typography variant="subtitle1">
							{i18n.t("contactDrawer.extraInfo")}
						</Typography>
						{contact?.extraInfo?.map(info => (
							<Paper
								key={info.id}
								square
								variant="outlined"
								className={classes.contactExtraInfo}
							>
								<InputLabel>{info.name}</InputLabel>
								<Typography component="div" noWrap style={{ paddingTop: 2 }}>
									<MarkdownWrapper>{info.value}</MarkdownWrapper>
								</Typography>
							</Paper>
						))}
					</Paper>
					<Paper square variant="outlined" className={classes.sectionCard}>
						<Typography variant="subtitle1">Pedido mais recente</Typography>
						<Typography variant="body2" color="textSecondary">
							Carregue nome, CPF/CNPJ, protocolo, email e demais dados do ultimo pedido nos campos do contato para usar em placeholders e automacoes.
						</Typography>
						<Button
							variant="outlined"
							color="primary"
							disabled={loadingCertificateFields}
							onClick={handleLoadLatestCertificateFields}
						>
							{loadingCertificateFields ? "Carregando..." : "Carregar ultimo pedido"}
						</Button>
					</Paper>
					<Paper square variant="outlined" className={classes.sectionCard}>
						<Typography variant="subtitle1">Pipelines do contato</Typography>
						{(contact?.pipelineMemberships || []).map(membership => (
							<div key={membership.id || `${membership.contactId}-${membership.pipelineId}`} className={classes.membershipRow}>
								<Typography variant="body2">
									<strong>{membership.pipeline?.name || "Pipeline"}</strong>
								</Typography>
								<TextField
									select
									label="Etapa"
									variant="outlined"
									size="small"
									value={membership.kanbanStageId || ""}
									onChange={event => {
										const nextStageId = Number(event.target.value);
										const nextMembership = {
											...membership,
											kanbanStageId: nextStageId,
										};
										handleMoveMembership(nextMembership);
									}}
								>
									{(membership.pipeline?.stages || pipelines.find(item => String(item.id) === String(membership.pipelineId))?.stages || [])
										.filter(stage => stage.active !== false)
										.map(stage => (
											<MenuItem key={stage.id} value={stage.id}>
												{stage.name}
											</MenuItem>
										))}
								</TextField>
								<div className={classes.inlineRow}>
									<Chip
										size="small"
										label={membership.kanbanStage?.name || "Sem etapa"}
										style={{
											backgroundColor: membership.kanbanStage?.color || membership.pipeline?.color || "#1976d2",
											color: "#fff"
										}}
									/>
									<Button
										size="small"
										variant="outlined"
										color="secondary"
										disabled={savingMembership}
										onClick={() => handleRemoveMembership(membership)}
									>
										Remover
									</Button>
								</div>
							</div>
						))}
						{!(contact?.pipelineMemberships || []).length && (
							<Typography variant="body2" color="textSecondary">
								Este contato ainda não está em pipelines paralelos.
							</Typography>
						)}
						<div className={classes.inlineRow}>
							<TextField
								select
								label="Adicionar pipeline"
								variant="outlined"
								size="small"
								value={selectedPipelineId}
								onChange={event => {
									setSelectedPipelineId(event.target.value);
									setSelectedStageId("");
								}}
								style={{ flex: 1, minWidth: 180 }}
							>
								{addablePipelines.map(pipeline => (
									<MenuItem key={pipeline.id} value={pipeline.id}>
										{pipeline.name}
									</MenuItem>
								))}
							</TextField>
							<TextField
								select
								label="Etapa"
								variant="outlined"
								size="small"
								value={selectedStageId}
								onChange={event => setSelectedStageId(event.target.value)}
								style={{ flex: 1, minWidth: 160 }}
								disabled={!selectedPipeline}
							>
								{(selectedPipeline?.stages || [])
									.filter(stage => stage.active !== false)
									.map(stage => (
										<MenuItem key={stage.id} value={stage.id}>
											{stage.name}
										</MenuItem>
									))}
							</TextField>
							<Button
								variant="outlined"
								color="primary"
								disabled={!selectedPipelineId || savingMembership}
								onClick={handleAddMembership}
							>
								Adicionar
							</Button>
						</div>
					</Paper>
				</div>
			)}
		</Drawer>
	);
};

export default ContactDrawer;
