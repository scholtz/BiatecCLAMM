if [ ! -f .env ]; then
  echo ".env file not found!"
  exit 1
fi

set -a
source .env
set +a

echo $ALGOD_SERVER
ts-node src/bin/clamm-pool-to-online.ts || error_code=$?
error_code_int=$(($error_code + 0))
if [ $error_code_int -ne 0 ]; then
  echo "run failed";
	exit 1;
fi
