# Robot-hosted Workbench installation

The Workbench is a device-local rolo plugin. It is not a public website and does not
run a second API proxy.

## Linux robot gate

Place the ZIP and its `.sha256` file in an operator-controlled staging directory:

```sh
sha256sum --check rolo-vis-0.38.0.zip.sha256
sudo install -d -m 0755 /opt/rolo/plugins
sudo unzip -q rolo-vis-0.38.0.zip -d /opt/rolo/plugins
sudo chown -R root:root /opt/rolo/plugins/rolo-vis-0.38.0
sudo find /opt/rolo/plugins/rolo-vis-0.38.0 -type d -exec chmod 0755 {} \;
sudo find /opt/rolo/plugins/rolo-vis-0.38.0 -type f -exec chmod 0644 {} \;
```

Configure `workbench.plugin_dir` as
`/opt/rolo/plugins/rolo-vis-0.38.0`, validate the rolo configuration, then bind only
to loopback:

```sh
robotctl config validate
robotctl runtime serve --host 127.0.0.1 --port 8080
```

The robot-owned reverse proxy may expose the same origin to an authorized engineering
network. It forwards `/workbench/` and `/rolo-api` to the loopback service and must
enforce authentication, TLS, network policy, and request limits. It must not inject an
API bearer token into browser content.

Verify locally before enabling the proxy:

```sh
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/rolo-api/health
curl --fail http://127.0.0.1:8080/workbench/
ROLO_ORIGIN=http://127.0.0.1:8080 ROLO_ROBOT_ID=mentorpi npm run check:robot-hosted-live
```

## Windows development gate

Expand the archive into an isolated directory, set `ROLO_WORKBENCH_PLUGIN_DIR` to the
inner `rolo-vis-0.38.0` directory, and keep rolo on loopback:

```powershell
Expand-Archive -LiteralPath .\rolo-vis-0.38.0.zip -DestinationPath .\plugin-gate
$env:ROLO_WORKBENCH_PLUGIN_DIR=(Resolve-Path .\plugin-gate\rolo-vis-0.38.0).Path
robotctl runtime serve --host 127.0.0.1 --port 8080
```

## Rollback

Keep the previous validated package immutable. Stop rolo, change
`workbench.plugin_dir` to that exact directory, run `robotctl config validate`, and
restart the loopback service. A rejected candidate is never made active, and rollback
does not rebuild or edit either package.
