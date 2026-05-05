# ConfigMaps and Secrets

This note explains how the basic app uses a ConfigMap and a Secret to pass database settings into Kubernetes Pods.

The main idea:

```text
ConfigMap = normal configuration
Secret = sensitive-looking configuration
```

In this app:

| File | Kubernetes Object | Stores |
| ---- | ----------------- | ------ |
| `configmap.yaml` | ConfigMap | `DB_HOST`, `DB_NAME` |
| `secret.yaml` | Secret | `DB_USER`, `DB_PASSWORD` |
| `deployment.yaml` | Deployment | Reads ConfigMap and Secret values for the backend |
| `postgres.yaml` | Deployment | Reads ConfigMap and Secret values for PostgreSQL |

---

## Why Use a ConfigMap?

A ConfigMap stores non-sensitive configuration outside the container image.

Example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  DB_HOST: postgres
  DB_NAME: postgres
```

These values are not secret. They tell the app where the database is and which database name to use.

---

## Why Use a Secret?

A Secret stores values that should not be written directly inside the Deployment file.

Example:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secret
type: Opaque
stringData:
  DB_USER: postgres
  DB_PASSWORD: postgres
```

`stringData` lets you write plain text values in YAML. Kubernetes converts those values into base64-encoded data when it stores the Secret.

Important: base64 is encoding, not encryption. Kubernetes Secrets are not automatically secure just because they are called Secrets.

For real projects, use a proper Secret Manager such as:

- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- External Secrets Operator connected to a real secret manager

Also avoid committing real passwords, tokens, private keys, or production credentials into Git.

---

## Backend Deployment

The backend reads database settings as environment variables:

```yaml
env:
  - name: DB_HOST
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: DB_HOST

  - name: DB_NAME
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: DB_NAME

  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: DB_USER

  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: DB_PASSWORD
```

The Node.js app already reads these values from `process.env`.

---

## Postgres Deployment

The PostgreSQL container expects these environment variables:

```yaml
env:
  - name: POSTGRES_USER
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: DB_USER

  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: DB_PASSWORD

  - name: POSTGRES_DB
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: DB_NAME
```

This keeps the database settings in one place instead of hard-coding them in `postgres.yaml`.

---

## Apply Order

Apply the ConfigMap and Secret before the Deployments that use them:

```bash
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f postgres.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

If the ConfigMap or Secret does not exist, Pods that reference them may fail to start.

---

## Useful Commands

Check that the objects exist:

```bash
kubectl get configmap myapp-config
kubectl get secret myapp-secret
```

View ConfigMap values:

```bash
kubectl describe configmap myapp-config
```

View Secret metadata:

```bash
kubectl describe secret myapp-secret
```

View the base64-encoded Secret data:

```bash
kubectl get secret myapp-secret -o yaml
```

Decode one value for learning:

```bash
kubectl get secret myapp-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 --decode
```

This decode command is useful for learning, but it also proves the security point: anyone with permission to read the Secret can decode the value.

---

## Mental Model

```text
ConfigMap gives the app normal settings.
Secret gives the app sensitive values.
Deployment injects both as environment variables.
The container reads them from process.env.
```

For learning, this is enough. For production, use a Secret Manager.
