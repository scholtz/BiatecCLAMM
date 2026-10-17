# Build environment for the Anthropic OSS Scanner (https://red.anthropic.com/oss-scanner).
# The scanner builds this with the repository root as the build context.
FROM node:24-bookworm
ENV CI=true \
    npm_config_fund=false \
    npm_config_audit=false
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates git python3 pipx build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

# AlgoKit CLI: used by `npm run generate-client` to emit the typed contract clients.
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN pipx install algokit==2.10.2

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# Install the exact locked dependencies (TEALScript compiler, algosdk, algokit utils, jest, ...).
RUN npm ci --include=dev

# Compile the TEALScript contracts (contracts/*.algo.ts -> TEAL + ARC-4/32/56 artifacts) and regenerate the
# typed TypeScript clients, exactly as maintainers do.
# TEALScript compiles TEAL through an algod `/v2/teal/compile` endpoint, so the build needs network access to a node
# (it is only used as a stateless compiler; a clean checkout has no .env). Network is available during this build only.
ARG ALGOD_SERVER=https://mainnet-api.4160.nodely.dev
ARG ALGOD_PORT=443
RUN for i in 1 2 3; do ALGOD_TOKEN="" npm run build && exit 0; echo "build attempt $i failed, retrying"; sleep 10; done; exit 1

# Run the tests that need no running Algorand node (tick math, SDK helpers, packaging). The full contract suite
# (__test__/clamm, __test__/pool, BiatecIdentity) needs an Algorand LocalNet (algod/kmd/indexer on 4001/4002/8980,
# normally started with `algokit localnet start`, which needs Docker) and therefore cannot run inside the scanner VM.
# Do not let failures abort the build.
RUN npx jest __test__/Ticks.test.ts __test__/common __test__/audit-2026-09-07-l03-optin-sender.test.ts --testTimeout 120000 \
    || echo "WARNING: offline jest tests reported failures"
