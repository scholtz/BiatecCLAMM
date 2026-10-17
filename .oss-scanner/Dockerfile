# Build environment for the Anthropic OSS Scanner (https://red.anthropic.com/oss-scanner).
# The scanner builds this with the repository root as the build context.
FROM node:24-bookworm
ENV DEBIAN_FRONTEND=noninteractive \
    CI=true \
    npm_config_fund=false \
    npm_config_audit=false
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git python3 python3-pip pipx build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

# AlgoKit CLI: used by `npm run generate-client` to emit the typed contract clients.
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN pipx install algokit

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# Install the exact locked dependencies (TEALScript compiler, algosdk, algokit utils, jest, ...).
RUN npm ci

# Compile the TEALScript contracts (contracts/*.algo.ts -> TEAL + ARC-4/32/56 artifacts) and regenerate the
# typed TypeScript clients, exactly as maintainers do.
RUN npm run build

# Run the tests that need no running Algorand node (tick math, SDK helpers, packaging). The full contract suite
# (__test__/clamm, __test__/pool, BiatecIdentity) needs an Algorand LocalNet (algod/kmd/indexer on 4001/4002/8980,
# normally started with `algokit localnet start`, which needs Docker) and therefore cannot run inside the scanner VM.
# Do not let failures abort the build.
RUN npx jest __test__/Ticks.test.ts __test__/common --testTimeout 120000 \
    || echo "WARNING: offline jest tests reported failures"
