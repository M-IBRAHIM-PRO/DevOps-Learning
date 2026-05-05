# Adding a Database Server in Kubernetes

This note explains how the basic app adds PostgreSQL inside Kubernetes and how the backend connects to it.

The key idea:

```text
Backend Pod does not connect directly to a Postgres Pod.
Backend Pod connects to a Postgres Service.
The Postgres Service sends traffic to the Postgres Pod.
```

---

## Final Flow

```text
Browser
  -> Ingress
  -> myapp-service
  -> backend Pod
  -> postgres Service
  -> postgres Pod
```

The database is internal. The browser never talks to PostgreSQL directly.

---

## Step 1 - Create a Postgres Deployment

The database container runs from the official PostgreSQL image:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
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
          ports:
            - containerPort: 5432
```

Important details:

- `name: postgres` names the Deployment
- `app: postgres` is the label used by the Service
- `POSTGRES_USER` comes from `secret.yaml`
- `POSTGRES_PASSWORD` comes from `secret.yaml`
- `POSTGRES_DB` comes from `configmap.yaml`
- `containerPort: 5432` is the normal PostgreSQL port

Important: Kubernetes Secrets are base64-encoded by default. Base64 is encoding, not encryption. In a real project, use a proper Secret Manager instead of storing real credentials directly in Git.

---

## Step 2 - Create a Postgres Service

Pods can be replaced at any time. A Service gives the database a stable network name.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
```

Important details:

- `metadata.name: postgres` creates the DNS name `postgres`
- `selector.app: postgres` connects this Service to Pods with `app=postgres`
- `port: 5432` exposes PostgreSQL inside the cluster

Inside the same namespace, other Pods can connect to:

```text
postgres:5432
```

---

## Step 3 - Add Persistent Storage

A normal Pod filesystem is temporary. If the Postgres Pod is deleted and recreated, data stored only inside the Pod can disappear.

To keep database files, `postgres.yaml` uses a PersistentVolumeClaim:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce

  resources:
    requests:
      storage: 1Gi
```

The Postgres container mounts that storage at the PostgreSQL data directory:

```yaml
volumeMounts:
  - name: postgres-storage
    mountPath: /var/lib/postgresql/data

volumes:
  - name: postgres-storage
    persistentVolumeClaim:
      claimName: postgres-pvc
```

Now the Pod can be replaced, but the database files stay attached to the PVC.

---

## Step 4 - Create Configuration

The app uses a ConfigMap for normal settings:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  DB_HOST: postgres
  DB_NAME: postgres
```

It uses a Secret for credentials:

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

`stringData` is convenient for learning because you can write normal text values. Kubernetes stores Secret values as base64-encoded data.

Again, base64 is not security. Use a Secret Manager for real credentials.

---

## Step 5 - Configure the Backend

The backend Deployment reads database settings from the ConfigMap and Secret:

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

This works because Kubernetes DNS resolves the `DB_HOST` value `postgres` to the Postgres Service.

The backend app then uses that value:

```js
host: process.env.DB_HOST || "localhost"
```

So the same app can run in two places:

| Environment | DB host value |
| ----------- | ------------- |
| Local       | `localhost` or a full connection URL |
| Kubernetes  | `postgres` |

---

## Step 6 - Apply Config First

Apply the ConfigMap and Secret before the Deployments:

```bash
cd Kubernetes/hands-on/basic-app/k8s
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
```

---

## Step 7 - Apply the Database

Apply PostgreSQL before the backend:

```bash
kubectl apply -f postgres.yaml
```

Check it:

```bash
kubectl get pods -l app=postgres
kubectl get svc postgres
kubectl get pvc postgres-pvc
```

Expected:

```text
postgres-...   1/1   Running
postgres       ClusterIP   5432/TCP
```

---

## Step 8 - Apply the Backend

After PostgreSQL exists, deploy the backend:

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

Check the backend:

```bash
kubectl get pods -l app=myapp
kubectl logs deployment/myapp
```

---

## Step 9 - Test the App

Port-forward the backend Service:

```bash
kubectl port-forward svc/myapp-service 8081:80
```

Open:

```text
http://localhost:8081
```

Expected:

```text
DB Time: <timestamp>
```

If you see a timestamp, the backend reached PostgreSQL successfully.

---

## Debugging Database Problems

### Check if Postgres is running

```bash
kubectl get pods -l app=postgres
kubectl logs deployment/postgres
```

### Check if the Postgres Service exists

```bash
kubectl get svc postgres
kubectl get endpoints postgres
```

If endpoints are empty, the Service selector does not match the Postgres Pod labels.

### Test PostgreSQL directly

```bash
kubectl exec -it deployment/postgres -- psql -U postgres -c "SELECT NOW();"
```

### Check backend environment variables

```bash
kubectl exec -it deployment/myapp -- printenv
```

You should see:

```text
DB_HOST=postgres
DB_NAME=postgres
DB_USER=postgres
```

### Check backend logs

```bash
kubectl logs deployment/myapp
```

Common database errors:

| Error | Meaning |
| ----- | ------- |
| `password authentication failed` | Wrong database user or password |
| `getaddrinfo ENOTFOUND postgres` | Postgres Service name does not exist |
| `ECONNREFUSED` | Service exists, but PostgreSQL is not accepting connections |
| `Database query failed` | Backend connected earlier, but a query failed |

---

## Important Learning Point

Do not hard-code a Pod IP.

Use a Service name:

```text
postgres
```

Kubernetes will keep that name stable even if the actual Postgres Pod is recreated with a new IP.

---

## What To Improve Later

This setup is intentionally simple for learning. Later, improve it by adding:

- Readiness and liveness probes for PostgreSQL
- Separate database user and database name
- A migration step for creating tables
- A real Secret Manager for production credentials
