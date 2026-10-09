param([ValidateSet("start","commit","prepush","ci")][string]$Mode="start")
sh scripts/agent_preflight.sh $Mode
exit $LASTEXITCODE
