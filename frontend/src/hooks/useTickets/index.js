import { useState, useEffect } from "react";
import { getHoursCloseTicketsAuto } from "../../config";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const useTickets = ({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    queueIds,
    withUnreadMessages,
}) => {
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [count, setCount] = useState(0);
    const [autoCloseHours, setAutoCloseHours] = useState(
        getHoursCloseTicketsAuto() || "0"
    );

    useEffect(() => {
        const fetchPublicSettings = async() => {
            try {
                const { data } = await api.get("/settings/public");
                const closeOpenTicketsSetting = data.find(
                    setting => setting.key === "closeOpenTicketsAfterHours"
                );

                if (closeOpenTicketsSetting?.value !== undefined) {
                    setAutoCloseHours(closeOpenTicketsSetting.value);
                }
            } catch (err) {
                // Keep the env fallback when public settings are unavailable.
            }
        };

        fetchPublicSettings();
    }, []);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchTickets = async() => {
                try {
                    const { data } = await api.get("/tickets", {
                        params: {
                            searchParam,
                            pageNumber,
                            status,
                            date,
                            showAll,
                            queueIds,
                            withUnreadMessages,
                        },
                    })
                    setTickets(data.tickets)

                    const horasFecharAutomaticamente = String(
                        autoCloseHours ?? getHoursCloseTicketsAuto() ?? "0"
                    ).trim();

                    if (status === "open" && horasFecharAutomaticamente && horasFecharAutomaticamente !== "" &&
                        horasFecharAutomaticamente !== "0" && Number(horasFecharAutomaticamente) > 0) {

                        let dataLimite = new Date()
                        dataLimite.setHours(dataLimite.getHours() - Number(horasFecharAutomaticamente))

                        data.tickets.forEach(ticket => {
                            if (ticket.status !== "closed") {
                                let dataUltimaInteracaoChamado = new Date(ticket.updatedAt)
                                if (dataUltimaInteracaoChamado < dataLimite)
                                    closeTicket(ticket)
                            }
                        })
                    }

                    setHasMore(data.hasMore)
                    setCount(data.count)
                    setLoading(false)
                } catch (err) {
                    setLoading(false)
                    toastError(err)
                }
            }

            const closeTicket = async(ticket) => {
                await api.put(`/tickets/${ticket.id}`, {
                    status: "closed",
                    userId: ticket.userId || null,
                })
            }

            fetchTickets()
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [
        searchParam,
        pageNumber,
        status,
        date,
        showAll,
        queueIds,
        withUnreadMessages,
        autoCloseHours,
    ])

    return { tickets, loading, hasMore, count };
};

export default useTickets;
