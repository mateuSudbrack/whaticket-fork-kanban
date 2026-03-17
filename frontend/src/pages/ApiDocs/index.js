import React, { useMemo } from "react";
import {
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Typography,
  makeStyles
} from "@material-ui/core";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const useStyles = makeStyles(theme => ({
  introPaper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    border: "1px solid rgba(25, 118, 210, 0.16)",
    background:
      "linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(0, 0, 0, 0))"
  },
  sectionPaper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2)
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1)
  },
  codeBlock: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: "#111827",
    color: "#e5eef9",
    overflowX: "auto",
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
  },
  codeActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(1)
  },
  chipRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(2)
  },
  muted: {
    color: theme.palette.text.secondary
  }
}));

const buildSections = baseUrl => [
  {
    title: "Autenticacao",
    description:
      "Use o login para obter o JWT usado nos endpoints protegidos do sistema.",
    curl: `curl -s "${baseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@whaticket.com",
    "password": "admin"
  }'`
  },
  {
    title: "Contatos",
    description:
      "Lista, cria, atualiza e remove contatos. Os campos globais entram em extraInfo.",
    curl: `curl "${baseUrl}/contacts" \\
  -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Cliente Teste",
    "number": "5511999999999",
    "email": "cliente@example.com",
    "extraInfo": [
      {
        "name": "CPF",
        "value": "12345678900",
        "fieldDefinitionId": 1
      }
    ]
  }'`
  },
  {
    title: "Campos Globais de Contato",
    description:
      "Gerencia o cadastro central dos campos personalizados exibidos em todos os contatos.",
    curl: `curl "${baseUrl}/contact-field-definitions" \\
  -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Plano",
    "type": "text",
    "required": false,
    "options": [],
    "sortOrder": 2,
    "active": true
  }'`
  },
  {
    title: "Tickets",
    description:
      "Busca tickets e atualiza status, responsavel e etapa do kanban.",
    curl: `curl "${baseUrl}/tickets/1" \\
  -X PUT \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "open",
    "userId": 1,
    "kanbanStageId": 2
  }'`
  },
  {
    title: "Estagios do Kanban",
    description:
      "Controla as colunas do board usadas pelo kanban das conversas.",
    curl: `curl "${baseUrl}/kanban-stages" \\
  -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Aguardando retorno",
    "color": "#ff9800",
    "sortOrder": 4,
    "active": true
  }'`
  },
  {
    title: "Mensagens",
    description:
      "Lista mensagens do ticket e envia texto ou arquivo para a conversa.",
    curl: `curl "${baseUrl}/messages/1" \\
  -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "body=Arquivo enviado pela API interna" \\
  -F "medias=@/tmp/arquivo.pdf"`
  },
  {
    title: "Conexoes WhatsApp",
    description:
      "Gerencia as conexoes do WhatsApp e permite criar novas sessoes.",
    curl: `curl "${baseUrl}/whatsapp/" \\
  -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Principal",
    "status": "OPENING",
    "isDefault": true,
    "queueIds": []
  }'`
  },
  {
    title: "API Externa por Token",
    description:
      "Envia mensagem sem JWT usando o valor de userApiToken salvo em Settings.",
    curl: `curl "${baseUrl}/messages/send" \\
  -X POST \\
  -H "Authorization: Bearer $API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "5511999999999",
    "body": "Mensagem enviada pela API externa",
    "whatsappId": 1
  }'`
  }
];

const ApiDocs = () => {
  const classes = useStyles();
  const origin = window.location.origin;
  const proxiedBaseUrl = `${origin}/api`;
  const directBackendUrl = "http://127.0.0.1:3000";

  const sections = useMemo(() => buildSections(proxiedBaseUrl), [proxiedBaseUrl]);

  const handleCopy = async content => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("clipboard_error", error);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>API do Whaticket</Title>
      </MainHeader>

      <Paper className={classes.introPaper} elevation={0}>
        <Typography variant="h6" gutterBottom>
          Documentacao rapida para integrar sem sair do painel
        </Typography>
        <Typography className={classes.muted}>
          Os exemplos abaixo usam a URL publica proxieda pelo frontend. Se voce
          estiver chamando o backend Node diretamente, troque a base para
          `http://127.0.0.1:3000`.
        </Typography>
        <div className={classes.chipRow}>
          <Chip label={`BASE_URL=${proxiedBaseUrl}`} color="primary" />
          <Chip label={`BACKEND_DIRETO=${directBackendUrl}`} />
          <Chip label="JWT via /auth/login" />
          <Chip label="Token externo via userApiToken" />
        </div>
      </Paper>

      <Paper className={classes.sectionPaper}>
        <Typography variant="subtitle1" gutterBottom>
          Variaveis uteis
        </Typography>
        <div className={classes.codeBlock}>
          {`export BASE_URL="${proxiedBaseUrl}"
export TOKEN="jwt-token"
export API_TOKEN="uuid-from-userApiToken"`}
        </div>
      </Paper>

      <Grid container spacing={2}>
        {sections.map(section => (
          <Grid item xs={12} key={section.title}>
            <Paper className={classes.sectionPaper}>
              <div className={classes.sectionHeader}>
                <div>
                  <Typography variant="h6">{section.title}</Typography>
                  <Typography className={classes.muted}>
                    {section.description}
                  </Typography>
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileCopyOutlinedIcon />}
                  onClick={() => handleCopy(section.curl)}
                >
                  Copiar curl
                </Button>
              </div>
              <Divider />
              <div className={classes.codeBlock}>{section.curl}</div>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </MainContainer>
  );
};

export default ApiDocs;
