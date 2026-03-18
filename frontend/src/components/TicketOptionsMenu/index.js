import React, { useContext, useEffect, useRef, useState } from "react";

import MenuItem from "@material-ui/core/MenuItem";
import Menu from "@material-ui/core/Menu";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import TransferTicketModal from "../TransferTicketModal";
import toastError from "../../errors/toastError";
import { Can } from "../Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import { toast } from "react-toastify";
import FlowRunDialog from "../FlowRunDialog";

const TicketOptionsMenu = ({
	ticket,
	menuOpen,
	handleClose,
	anchorEl,
	onUpdateTicket
}) => {
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
	const [flowDialogOpen, setFlowDialogOpen] = useState(false);
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleDeleteTicket = async () => {
		try {
			await api.delete(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenConfirmationModal = e => {
		setConfirmationOpen(true);
		handleClose();
	};

	const handleOpenTransferModal = e => {
		setTransferTicketModalOpen(true);
		handleClose();
	};

	const handleOpenFlowDialog = () => {
		setFlowDialogOpen(true);
		handleClose();
	};

	const handleToggleFlowsPaused = async () => {
		try {
			const { data } = await api.put(`/tickets/${ticket.id}`, {
				flowsPaused: !ticket.flowsPaused,
			});
			if (onUpdateTicket) {
				onUpdateTicket(data);
			}
			toast.success(data.flowsPaused ? "Fluxos pausados" : "Fluxos retomados");
		} catch (err) {
			toastError(err);
		}
		handleClose();
	};

	const handleCloseTransferTicketModal = () => {
		if (isMounted.current) {
			setTransferTicketModalOpen(false);
		}
	};

	return (
		<>
			<Menu
				id="menu-appbar"
				anchorEl={anchorEl}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				keepMounted
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuOpen}
				onClose={handleClose}
			>
				<MenuItem onClick={handleOpenTransferModal}>
					{i18n.t("ticketOptionsMenu.transfer")}
				</MenuItem>
				<MenuItem onClick={handleOpenFlowDialog}>
					Enviar fluxo
				</MenuItem>
				<MenuItem onClick={handleToggleFlowsPaused}>
					{ticket.flowsPaused ? "Retomar automacoes" : "Pausar todos fluxos"}
				</MenuItem>
				<Can
					role={user.profile}
					perform="ticket-options:deleteTicket"
					yes={() => (
						<MenuItem onClick={handleOpenConfirmationModal}>
							{i18n.t("ticketOptionsMenu.delete")}
						</MenuItem>
					)}
				/>
			</Menu>
			<ConfirmationModal
				title={`${i18n.t("ticketOptionsMenu.confirmationModal.title")}${
					ticket.id
				} ${i18n.t("ticketOptionsMenu.confirmationModal.titleFrom")} ${
					ticket.contact.name
				}?`}
				open={confirmationOpen}
				onClose={setConfirmationOpen}
				onConfirm={handleDeleteTicket}
			>
				{i18n.t("ticketOptionsMenu.confirmationModal.message")}
			</ConfirmationModal>
			<TransferTicketModal
				modalOpen={transferTicketModalOpen}
				onClose={handleCloseTransferTicketModal}
				ticketid={ticket.id}
				ticketWhatsappId={ticket.whatsappId}
			/>
			<FlowRunDialog
				open={flowDialogOpen}
				onClose={() => setFlowDialogOpen(false)}
				ticketId={ticket.id}
			/>
		</>
	);
};

export default TicketOptionsMenu;
