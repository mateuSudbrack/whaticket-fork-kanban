FROM node:20-bookworm as build-deps

RUN apt-get update && apt-get install -y wget git dumb-init \
    chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN git config --global url."https://github.com/".insteadOf git://github.com/ \
    && git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
    && git config --global url."https://github.com/".insteadOf git@github.com:

RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -- "$@"' \
    'rewritten_args=""' \
    'for arg in "$@"; do' \
    '  case "$arg" in' \
    '    git://github.com/*)' \
    '      arg="https://github.com/${arg#git://github.com/}"' \
    '      ;;' \
    '    ssh://git@github.com/*)' \
    '      arg="https://github.com/${arg#ssh://git@github.com/}"' \
    '      ;;' \
    '    git@github.com:*)' \
    '      arg="https://github.com/${arg#git@github.com:}"' \
    '      ;;' \
    '  esac' \
    '  rewritten_args="$rewritten_args \"${arg}\""' \
    'done' \
    'eval "set -- $rewritten_args"' \
    'exec /usr/bin/git "$@"' \
    > /usr/local/bin/git \
    && chmod +x /usr/local/bin/git

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV CHROME_BIN=/usr/bin/chromium

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
