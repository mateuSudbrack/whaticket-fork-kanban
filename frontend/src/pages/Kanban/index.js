import React, { useContext, useEffect, useState } from "react";
import {
  FormControlLabel,
  Paper,
  Switch,
  Typography,
  makeStyles
} from "@material-ui/core";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TicketsKanban from "../../components/TicketsKanban";
import TicketsQueueSelect from "../../components/TicketsQueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    height: "100%"
  },
  intro: {
    color: theme.palette.text.secondary
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    borderRadius: 14,
    flexWrap: "wrap"
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  boardShell: {
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1),
    borderRadius: 18,
    overflow: "hidden"
  }
}));

const Kanban = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const userQueueIds = user.queues.map(queue => queue.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [showAllTickets, setShowAllTickets] = useState(false);

  useEffect(() => {
    if (user.profile?.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
  }, [user.profile]);

  return (
    <MainContainer>
      <MainHeader>
        <Title>Kanban</Title>
      </MainHeader>

      <div className={classes.page}>
        <Typography variant="body2" className={classes.intro}>
          Este quadro mostra o mesmo fluxo operacional de tickets: aguardando, em atendimento e resolvido.
        </Typography>

        <Paper elevation={0} variant="outlined" className={classes.toolbar}>
          <div className={classes.toolbarLeft}>
            <Can
              role={user.profile}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() => setShowAllTickets(prevState => !prevState)}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              )}
            />
            <TicketsQueueSelect
              selectedQueueIds={selectedQueueIds}
              userQueues={user?.queues}
              onChange={values => setSelectedQueueIds(values)}
            />
          </div>
        </Paper>

        <Paper elevation={0} variant="outlined" className={classes.boardShell}>
          <TicketsKanban
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
          />
        </Paper>
      </div>
    </MainContainer>
  );
};

export default Kanban;
