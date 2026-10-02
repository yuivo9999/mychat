FROM node:20-alpine

# Runtime dependencies required by Agent command execution. Command execution remains
# opt-in via AGENT_COMMAND_EXECUTION_ENABLED and is isolated from the server UID below.
RUN apk add --no-cache bash git python3 \
    && mkdir -p /tmp/ivochat-agent-command \
    && chmod 0711 /tmp/ivochat-agent-command

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build \
    && chmod -R a=rX /app

ENV NODE_ENV=production \
    PORT=3000 \
    AGENT_COMMAND_EXECUTION_ENABLED=false \
    AGENT_COMMAND_WORK_ROOT=/tmp/ivochat-agent-command \
    AGENT_COMMAND_UID=65534 \
    AGENT_COMMAND_GID=65534 \
    AGENT_COMMAND_DROP_PRIVILEGES=true

EXPOSE 3000

# The server needs root only so it can chown each ephemeral project to UID/GID 65534 before
# spawning commands. Project files and application code remain read-only to that command UID.
USER root
CMD ["npm", "start"]
