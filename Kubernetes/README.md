# Kubernetes Learning Repo

This repository is for learning Kubernetes from the beginning with a small practical app.

The goal is not to memorize every Kubernetes object. The goal is to understand how traffic and dependencies move through a real application:

```text
User -> Ingress -> Service -> Backend Pod -> Postgres Service -> Postgres Pod
```

In this repo, you will learn that flow using a Node.js backend, PostgreSQL, Kubernetes YAML files, and beginner-friendly notes.

---

## What You Will Learn

By working through this repo, you should understand:

- What a Pod is
- Why Deployments are used instead of creating Pods directly
- Why Services are needed
- What Ingress does
- How one Pod connects to another app through a Service
- How environment variables configure containers
- How to debug common Kubernetes problems
- How to run a simple app with a database on a local Kubernetes cluster using Kind

---

## Repository Structure

```text
Kubernetes/
|-- README.md
|-- concepts.md
|-- hands-on/
|   `-- basic-app/
|       |-- backend/
|       |   |-- Dockerfile
|       |   |-- package.json
|       |   `-- server.js
|       `-- k8s/
|           |-- kind-config.yaml
|           |-- configmap.yaml
|           |-- secret.yaml
|           |-- deployment.yaml
|           |-- service.yaml
|           |-- ingress.yaml
|           `-- postgres.yaml
`-- notes/
    |-- debugging.md
    |-- common-errors.md
    |-- configmap-and-secrets.md
    |-- persistent-postgres-data.md
    `-- adding-db-server.md
```

### `concepts.md`

Start here if Kubernetes feels confusing.

This file explains Kubernetes using a restaurant analogy:

| Kubernetes Concept | Restaurant Analogy |
| ------------------ | ------------------ |
| Pod                | Kitchen            |
| Deployment         | Manager            |
| Service            | Waiter             |
| Ingress            | Reception          |
| Node               | Building           |
| ConfigMap / Secret | Recipe Book        |

### `hands-on/basic-app/backend`

This is the Node.js backend.

- `server.js` starts a web server on port `3000`
- `server.js` connects to PostgreSQL and returns the database time
- `package.json` contains the `npm start` script
- `Dockerfile` builds the backend image

### `hands-on/basic-app/k8s`

This folder contains the Kubernetes files:

- `configmap.yaml` stores non-sensitive app configuration such as database host and database name
- `secret.yaml` stores sensitive-looking values such as database username and password for learning
- `postgres.yaml` runs PostgreSQL and exposes it inside the cluster
- `deployment.yaml` runs the backend Pods
- `service.yaml` exposes the backend Pods inside the cluster
- `ingress.yaml` routes browser traffic to the backend Service
- `kind-config.yaml` creates a local Kind cluster with port mapping

### `notes/`

Use these when learning or debugging:

- `debugging.md` gives a step-by-step debugging workflow
- `common-errors.md` lists common Kubernetes errors and fixes
- `configmap-and-secrets.md` explains how ConfigMaps and Secrets are used in this app
- `persistent-postgres-data.md` explains how PostgreSQL data survives Pod restarts
- `adding-db-server.md` explains how the PostgreSQL server was added

---

## Prerequisites

Before running the hands-on app, install:

- Docker
- kubectl
- Kind
- Node.js, optional for running the backend locally outside Kubernetes

Check your tools:

```bash
docker --version
kubectl version --client
kind version
node --version
```

---

## Learning Path

Follow this order:

1. Read `concepts.md`
2. Run the backend locally with Node.js
3. Build the backend Docker image
4. Create a local Kubernetes cluster with Kind
5. Load the Docker image into Kind
6. Apply the ConfigMap and Secret
7. Apply the PostgreSQL YAML
8. Apply the backend Deployment and Service
9. Access the app through port-forwarding or Ingress
10. Break things intentionally and debug them using `notes/`

This order matters because Kubernetes becomes much easier when you see each layer separately.

---

## Run the Backend Locally

Go to the backend folder:

```bash
cd Kubernetes/hands-on/basic-app/backend
```

Install dependencies:

```bash
npm install
```

Make sure `.env` points to a local PostgreSQL database:

```env
DB_HOST=postgres://ibrahim:123456@localhost:5432/postgres?sslmode=disable
```

Run the backend:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Expected response:

```text
DB Time: <timestamp>
```

Stop the app with `Ctrl + C`.

---

## Build the Docker Image

From the backend folder, build the image:

```bash
cd Kubernetes/hands-on/basic-app/backend
docker build -t myapp:v3 .
```

Verify:

```bash
docker images
```

You should see:

```text
myapp   v3
```

---

## Create a Kind Cluster

Create a local Kubernetes cluster from the `k8s` folder:

```bash
cd Kubernetes/hands-on/basic-app/k8s
kind create cluster --name demo-cluster --config kind-config.yaml
```

Verify the cluster:

```bash
kubectl cluster-info
kubectl get nodes
```

Expected:

```text
STATUS
Ready
```

---

## Load the Docker Image into Kind

Kind runs Kubernetes inside Docker, so it cannot automatically see every image from your host machine.

Load the image:

```bash
kind load docker-image myapp:v3 --name demo-cluster
```

---

## Create App Configuration

Before deploying PostgreSQL or the backend, apply the configuration files:

```bash
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
```

The ConfigMap stores normal configuration:

```yaml
DB_HOST: postgres
DB_NAME: postgres
```

The Secret stores database credentials:

```yaml
DB_USER: postgres
DB_PASSWORD: postgres
```

Important: Kubernetes Secrets are base64-encoded by default. Base64 is encoding, not encryption. A Secret is not automatically secure just because it is a Kubernetes Secret. For real projects, use a proper Secret Manager such as HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Google Secret Manager, or an External Secrets Operator setup.

---

## Deploy PostgreSQL

Apply the database manifest:

```bash
kubectl apply -f postgres.yaml
```

Check the result:

```bash
kubectl get pods
kubectl get svc postgres
kubectl get pvc postgres-pvc
```

Expected:

```text
postgres-...   1/1   Running
postgres       ClusterIP   5432/TCP
postgres-pvc   Bound
```

The important part is the Service name:

```text
postgres
```

Inside Kubernetes, the backend can connect to the database by using `postgres` as the host name.

PostgreSQL reads its username and password from `secret.yaml`, and the database name from `configmap.yaml`:

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

PostgreSQL also uses a PersistentVolumeClaim named `postgres-pvc`:

```yaml
volumeMounts:
  - name: postgres-storage
    mountPath: /var/lib/postgresql/data

volumes:
  - name: postgres-storage
    persistentVolumeClaim:
      claimName: postgres-pvc
```

That means the database files live on persistent storage, not only inside the temporary Pod filesystem.

---

## Deploy the Backend

Apply the backend Deployment and Service:

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

Check the result:

```bash
kubectl get pods
kubectl get svc
```

Expected:

```text
myapp-...        1/1   Running
postgres-...     1/1   Running
myapp-service    ClusterIP
postgres         ClusterIP
```

The backend Deployment reads database configuration from the ConfigMap and Secret:

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

That tells the backend to connect to the Kubernetes Service named `postgres` using the database credentials from the Secret.

---

## Test the Service Directly

Before using Ingress, test the backend Service:

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

Stop port forwarding with `Ctrl + C`.

---

## Enable Ingress

Ingress needs an Ingress Controller. The `ingress.yaml` file only defines routing rules; it does not handle traffic by itself.

For a local Kind cluster, install the Nginx Ingress Controller using the official ingress-nginx Kind installation instructions.

After the Ingress Controller is running, apply the Ingress resource:

```bash
kubectl apply -f ingress.yaml
```

Check it:

```bash
kubectl get ingress
```

The app uses this host:

```text
myapp.local
```

Add it to your hosts file:

```bash
sudo nano /etc/hosts
```

Add:

```text
127.0.0.1 myapp.local
```

Now open:

```text
http://myapp.local:8080
```

Expected response:

```text
DB Time: <timestamp>
```

---

## Important Kubernetes Flow

When the browser sends a request, the request travels like this:

```text
Browser
  -> Ingress
  -> Backend Service
  -> Backend Pod
  -> Postgres Service
  -> Postgres Pod
```

In this repo:

| Layer            | File / Object         | Purpose                         |
| ---------------- | --------------------- | ------------------------------- |
| Browser          | `myapp.local:8080`    | User entry point                |
| Ingress          | `ingress.yaml`        | Routes traffic to backend       |
| Backend Service  | `service.yaml`        | Provides stable access to Pods  |
| Backend Pods     | `deployment.yaml`     | Run the Node.js container       |
| Postgres Service | `postgres.yaml`       | Stable internal database name   |
| Postgres Pod     | `postgres.yaml`       | Runs the PostgreSQL container   |
| Postgres PVC     | `postgres.yaml`       | Keeps database files persistent |

---

## Debugging Cheat Sheet

Use these commands often:

```bash
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl get svc
kubectl get endpoints
kubectl get ingress
kubectl describe ingress myapp-ingress
kubectl get nodes
kubectl cluster-info
```

For database checks:

```bash
kubectl get svc postgres
kubectl logs deployment/postgres
kubectl describe pod -l app=postgres
kubectl exec -it deployment/postgres -- psql -U postgres -c "SELECT NOW();"
kubectl get pvc postgres-pvc
```

If the app does not work, debug in this order:

```text
Pods -> Services -> Database -> Ingress -> Cluster
```

Useful checks:

```bash
kubectl get pods
kubectl get endpoints
kubectl get svc
kubectl get ingress
```

If `kubectl get endpoints` shows:

```text
<none>
```

then a Service is not connected to any Pods. Usually this means the labels in the Deployment and Service do not match.

---

## Common Problems

### ImagePullBackOff

The cluster cannot find the Docker image.

Fix:

```bash
docker build -t myapp:v3 ../backend
kind load docker-image myapp:v3 --name demo-cluster
kubectl rollout restart deployment myapp
```

### Backend Cannot Connect to Postgres

Check the backend logs:

```bash
kubectl logs deployment/myapp
```

Then check the database:

```bash
kubectl get pods -l app=postgres
kubectl get svc postgres
kubectl logs deployment/postgres
```

Make sure `deployment.yaml` uses the same Service name:

```yaml
env:
  - name: DB_HOST
    valueFrom:
      configMapKeyRef:
        name: myapp-config
        key: DB_HOST
```

Also make sure the ConfigMap and Secret exist:

```bash
kubectl get configmap myapp-config
kubectl get secret myapp-secret
```

### 503 Service Temporarily Unavailable

Ingress is working, but the Service has no healthy backend Pods.

Check:

```bash
kubectl get pods
kubectl get endpoints
```

### Ingress Not Working

Remember:

```text
Ingress resource + Ingress Controller = working ingress
```

The YAML file alone is not enough.

### Changes Not Showing

Rebuild and reload the image:

```bash
docker build -t myapp:v3 ../backend
kind load docker-image myapp:v3 --name demo-cluster
kubectl set image deployment/myapp myapp=myapp:v3
```

---

## Clean Up

Delete the Kubernetes resources:

```bash
kubectl delete -f ingress.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml
kubectl delete -f postgres.yaml
kubectl delete -f secret.yaml
kubectl delete -f configmap.yaml
```

Delete the Kind cluster:

```bash
kind delete cluster --name demo-cluster
```

---

## Official References

- Kubernetes documentation: https://kubernetes.io/docs/home/
- Kind documentation: https://kind.sigs.k8s.io/docs/
- Kind Ingress guide: https://kind.sigs.k8s.io/docs/user/ingress/
- ingress-nginx documentation: https://kubernetes.github.io/ingress-nginx/
- PostgreSQL Docker image: https://hub.docker.com/_/postgres

---

## Final Mental Model

Kubernetes is not just about running containers.

It is about declaring the desired state:

```text
I want PostgreSQL running.
I want 2 replicas of this backend running.
Expose the backend through a stable Service.
Let the backend reach PostgreSQL through another stable Service.
Route outside traffic through Ingress.
Recover automatically if something fails.
```

Kubernetes then works continuously to keep the system close to that desired state.

Start simple, debug layer by layer, and keep coming back to the request flow:

```text
User -> Ingress -> Service -> Pod -> Service -> Pod
```
