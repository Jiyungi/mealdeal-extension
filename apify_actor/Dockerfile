FROM apify/actor-node-playwright-chrome:24-1.59.1

USER root
WORKDIR /usr/src/app
RUN chown -R myuser:myuser /usr/src/app
USER myuser

COPY --chown=myuser:myuser package*.json ./
RUN npm ci --include=dev

COPY --chown=myuser:myuser . ./
RUN npm run build
RUN npm prune --omit=dev --no-save --package-lock=false

CMD ["npm", "start"]
