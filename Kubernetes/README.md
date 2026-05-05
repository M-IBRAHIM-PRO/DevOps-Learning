# Kubernetes Learning Repo

This repository is for someone who is learning Kubernetes from the beginning and wants a simple, practical path from concepts to a real working app.

The goal is not to memorize every Kubernetes object. The goal is to understand the basic flow:

```text
User -> Ingress -> Service -> Pod -> Container
```

In this repo, you will learn that flow using a small Node.js app, Kubernetes YAML files, and beginner-friendly notes.

---

## What You Will Learn

By working through this repo, you should understand:

- What a Pod is
- Why Deployments are used instead of creating Pods directly
- Why Services are needed
- What Ingress does
- How traffic reaches an application inside Kubernetes
- How to debug common Kubernetes problems
- How to run a simple app on a local Kubernetes cluster using Kind

---

## Repository Structure

```text
.
|-- README.md
|-- concepts.md
|-- hands-on/
|   `-- basic-app/
|       |-- Dockerfile
|       |-- server.js
|       |-- package.json
|       |-- kind-config.yaml
|       |-- deployment.yaml
|       |-- service.yaml
|       `-- ingress.yaml
`-- notes/
    |-- debugging.md
    `-- common-errors.md
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

### `hands-on/basic-app`

This is the practical part of the repo.

It contains a very small Node.js application and the Kubernetes files needed to run it:

- `server.js` starts a web server on port `3000`
- `Dockerfile` builds the app image
- `deployment.yaml` runs the app as Kubernetes Pods
- `service.yaml` exposes the Pods inside the cluster
- `ingress.yaml` routes browser traffic to the Service
- `kind-config.yaml` creates a local Kind cluster with port mapping

### `notes/debugging.md`

Use this when something is not working and you want a step-by-step debugging flow.

### `notes/common-errors.md`

Use this when you see common errors like:

- `ImagePullBackOff`
- `CrashLoopBackOff`
- `ContainerCreating`
- `503 Service Temporarily Unavailable`
- Service has no endpoints
- Ingress not working

---

## Prerequisites

Before running the hands-on app, install:

- Docker
- kubectl
- Kind
- Node.js, optional for running the app locally outside Kubernetes

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
2. Run the app locally with Node.js
3. Build the Docker image
4. Create a local Kubernetes cluster with Kind
5. Load the Docker image into Kind
6. Apply the Kubernetes YAML files
7. Access the app through Ingress
8. Break things intentionally and debug them using `notes/`

This order matters because Kubernetes becomes much easier when you see each layer separately.

---

## Run the App Locally

Go to the app folder:

```bash
cd hands-on/basic-app
```

Run the Node.js app:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Expected response:

```text
Hello from Kubernetes 🚀
```

Stop the app with `Ctrl + C`.

---

## Build the Docker Image

From `hands-on/basic-app`, build the image:

```bash
docker build -t myapp:v1 .
```

Verify:

```bash
docker images
```

You should see:

```text
myapp   v1
```

---

## Create a Kind Cluster

Create a local Kubernetes cluster:

```bash
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
kind load docker-image myapp:v1 --name demo-cluster
```

---

## Deploy the App to Kubernetes

Apply the Deployment:

```bash
kubectl apply -f deployment.yaml
```

Apply the Service:

```bash
kubectl apply -f service.yaml
```

Check the result:

```bash
kubectl get pods
kubectl get svc
```

Expected:

```text
myapp-...   1/1   Running
myapp-service   ClusterIP
```

---

## Test the Service Directly

Before using Ingress, test the Service:

```bash
kubectl port-forward svc/myapp-service 8081:80
```

Open:

```text
http://localhost:8081
```

Expected:

```text
Hello from Kubernetes 🚀
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
Hello from Kubernetes 🚀
```

---

## Important Kubernetes Flow

When the browser sends a request, the request travels like this:

```text
Browser
  -> Ingress
  -> Service
  -> Pod
  -> Container
```

In this repo:

| Layer      | File / Object        | Purpose                         |
| ---------- | -------------------- | ------------------------------- |
| Browser    | `myapp.local:8080`   | User entry point                |
| Ingress    | `ingress.yaml`       | Routes traffic to the Service   |
| Service    | `service.yaml`       | Provides stable access to Pods  |
| Deployment | `deployment.yaml`    | Creates and manages Pods        |
| Pod        | Created by Deployment | Runs the app container          |
| Container  | `myapp:v1`           | Runs the Node.js server         |

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

If the app does not work, debug in this order:

```text
Pods -> Service -> Ingress -> Cluster
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

then the Service is not connected to any Pods. Usually this means the labels in `deployment.yaml` and `service.yaml` do not match.

---

## Common Problems

### ImagePullBackOff

The cluster cannot find the Docker image.

Fix:

```bash
docker build -t myapp:v1 .
kind load docker-image myapp:v1 --name demo-cluster
kubectl rollout restart deployment myapp
```

### 503 Service Temporarily Unavailable

Ingress is working, but the Service has no healthy Pods.

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
docker build -t myapp:v2 .
kind load docker-image myapp:v2 --name demo-cluster
kubectl set image deployment/myapp myapp=myapp:v2
```

---

## Clean Up

Delete the Kubernetes resources:

```bash
kubectl delete -f ingress.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml
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

---

## Final Mental Model

Kubernetes is not just about running containers.

It is about declaring the desired state:

```text
I want 2 replicas of this app running.
Expose them through a stable Service.
Route outside traffic through Ingress.
Recover automatically if something fails.
```

Kubernetes then works continuously to keep the system close to that desired state.

Start simple, debug layer by layer, and keep coming back to the request flow:

```text
User -> Ingress -> Service -> Pod -> Container
```
