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
            - name: POSTGRES_PASSWORD
              value: postgres
          ports:
            - containerPort: 5432
```

Important details:

- `name: postgres` names the Deployment
- `app: postgres` is the label used by the Service
- `POSTGRES_PASSWORD` sets the database password
- `containerPort: 5432` is the normal PostgreSQL port

For learning, a plain environment value is fine. In a real project, put passwords in a Kubernetes Secret.

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

## Step 3 - Configure the Backend

The backend Deployment passes the database host as an environment variable:

```yaml
env:
  - name: DB_HOST
    value: postgres
```

This works because Kubernetes DNS resolves `postgres` to the Postgres Service.

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

## Step 4 - Apply the Database First

Apply PostgreSQL before the backend:

```bash
cd Kubernetes/hands-on/basic-app/k8s
kubectl apply -f postgres.yaml
```

Check it:

```bash
kubectl get pods -l app=postgres
kubectl get svc postgres
```

Expected:

```text
postgres-...   1/1   Running
postgres       ClusterIP   5432/TCP
```

---

## Step 5 - Apply the Backend

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

## Step 6 - Test the App

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

- A Kubernetes Secret for the password
- A PersistentVolumeClaim so database data survives Pod restarts
- Readiness and liveness probes for PostgreSQL
- Separate database user and database name
- A migration step for creating tables
