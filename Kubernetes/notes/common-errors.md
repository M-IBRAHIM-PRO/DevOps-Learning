# ⚠️ Kubernetes Common Errors & Debugging Playbook

This document lists **real issues encountered during development** and how to debug them quickly.

---

# 🧠 Debugging Philosophy

Always debug in this order:

```text
Pods → Service → Ingress → Cluster
````

Never jump randomly.

---

# 🔴 1. ImagePullBackOff

### ❌ Symptom

```bash
kubectl get pods
```

```text
ImagePullBackOff
```

---

### 🧠 Cause

* Image not available in cluster
* Wrong image name/tag
* No access to registry

---

### ✅ Fix (Kind-specific)

```bash
kind load docker-image myapp:v2 --name demo-cluster
kubectl rollout restart deployment myapp
```

---

### 🧪 Verify

```bash
kubectl get pods
```

```text
Running
```

---

# 🔴 2. 503 Service Temporarily Unavailable

### ❌ Symptom

Browser shows:

```text
503 Service Temporarily Unavailable
```

---

### 🧠 Cause

Ingress works, but:

```text
Service has no healthy backend pods
```

---

### 🔍 Debug

```bash
kubectl get pods
kubectl get endpoints
```

---

### ❌ If endpoints show:

```text
<none>
```

👉 No pods are connected to service

---

### ✅ Fix

* Ensure pods are running
* Fix readiness probe
* Fix labels mismatch

---

# 🔴 3. Pods Running but Not Ready (0/1)

### ❌ Symptom

```text
READY 0/1
```

---

### 🧠 Cause

Readiness probe failing

---

### 🔍 Debug

```bash
kubectl describe pod <pod-name>
```

Look for:

```text
Readiness probe failed
```

---

### ✅ Fix

Increase delay:

```yaml
readinessProbe:
  initialDelaySeconds: 10
```

---

# 🔴 4. ContainerCreating Stuck

### ❌ Symptom

```text
STATUS: ContainerCreating
```

---

### 🧠 Causes

* Image pulling slow
* Missing secret
* Volume mount issue

---

### 🔍 Debug

```bash
kubectl describe pod <pod-name>
```

Check:

```text
Events section
```

---

### Example Error

```text
secret not found
```

---

### ✅ Fix

* Reinstall ingress (for secret issues)
* Wait for image pull
* Ensure resources exist

---

# 🔴 5. Connection Refused (kubectl)

### ❌ Symptom

```text
The connection to the server localhost:8080 was refused
```

---

### 🧠 Cause

* Cluster not running
* kubeconfig not set

---

### ✅ Fix

```bash
kind create cluster
kubectl cluster-info
```

---

# 🔴 6. Apache Default Page Instead of App

### ❌ Symptom

Browser shows Apache page

---

### 🧠 Cause

Port 80 already used by Apache

---

### ✅ Fix

Use different port (e.g., 8080)

---

# 🔴 7. Ingress Not Working

### ❌ Symptom

No response / 404 / timeout

---

### 🧠 Cause

* Ingress controller not installed
* Ingress rules exist but no controller

---

### 🔍 Debug

```bash
kubectl get pods -n ingress-nginx
```

---

### ✅ Fix

```bash
kubectl apply -f ingress-nginx.yaml
```

---

# 🔴 8. Service Has No Endpoints

### ❌ Symptom

```bash
kubectl get endpoints
```

```text
<none>
```

---

### 🧠 Cause

Label mismatch

---

### 🔍 Check

```yaml
# Deployment
labels:
  app: myapp

# Service
selector:
  app: myapp
```

---

### ✅ Fix

Ensure labels match exactly

---

# 🔴 9. YAML Validation Errors

### ❌ Symptom

```text
unknown field "..."
```

---

### 🧠 Cause

Wrong indentation or wrong level

---

### Example Mistake

```yaml
spec:
  readinessProbe: ❌
```

---

### ✅ Fix

Move inside container:

```yaml
containers:
  - name: app
    readinessProbe: ✅
```

---

# 🔴 10. Ingress Controller Stuck (Secret Missing)

### ❌ Symptom

```text
MountVolume.SetUp failed: secret not found
```

---

### 🧠 Cause

Ingress controller started before secret creation

---

### ✅ Fix

```bash
kubectl delete -f ingress-nginx.yaml
kubectl apply -f ingress-nginx.yaml
```

---

# 🔴 11. Docker Permission Denied

### ❌ Symptom

```text
permission denied /var/run/docker.sock
```

---

### 🧠 Cause

User not in docker group or session not refreshed

---

### ✅ Fix

```bash
sudo usermod -aG docker $USER
reboot
```

---

# 🔴 12. Changes Not Reflected

### ❌ Symptom

App not updating after changes

---

### 🧠 Cause

Image not rebuilt or not reloaded

---

### ✅ Fix

```bash
docker build -t myapp:v2 .
kind load docker-image myapp:v2
kubectl set image deployment/myapp myapp=myapp:v2
```

---

# 🔴 13. Backend Cannot Find Postgres

### ❌ Symptom

Backend logs show:

```text
getaddrinfo ENOTFOUND postgres
```

---

### 🧠 Cause

The backend is trying to connect to a Service name that does not exist.

---

### 🔍 Debug

```bash
kubectl get svc postgres
kubectl get endpoints postgres
kubectl exec -it deployment/myapp -- printenv
```

---

### ✅ Fix

Make sure `postgres.yaml` has a Service named `postgres`:

```yaml
metadata:
  name: postgres
```

Make sure `deployment.yaml` uses the same name:

```yaml
env:
  - name: DB_HOST
    value: postgres
```

---

# 🔴 14. Postgres Password Authentication Failed

### ❌ Symptom

Backend logs show:

```text
password authentication failed
```

---

### 🧠 Cause

The backend is reaching PostgreSQL, but the username or password is wrong.

---

### 🔍 Debug

```bash
kubectl logs deployment/myapp
kubectl logs deployment/postgres
kubectl exec -it deployment/postgres -- psql -U postgres -c "SELECT NOW();"
```

---

### ✅ Fix

For the current learning setup:

```yaml
# postgres.yaml
env:
  - name: POSTGRES_PASSWORD
    value: postgres
```

The backend default password is also `postgres`, so those values must match.

---

# 🔴 15. Postgres Service Has No Endpoints

### ❌ Symptom

```bash
kubectl get endpoints postgres
```

```text
postgres   <none>
```

---

### 🧠 Cause

The Postgres Service selector does not match the Postgres Pod labels.

---

### 🔍 Check

```yaml
# Postgres Pod labels
labels:
  app: postgres

# Postgres Service selector
selector:
  app: postgres
```

---

### ✅ Fix

Ensure labels match exactly, then apply again:

```bash
kubectl apply -f postgres.yaml
```

---

# 🧠 Golden Debug Commands

Always use these:

```bash
kubectl get pods
kubectl describe pod <pod>
kubectl logs <pod>
kubectl get svc
kubectl get endpoints
kubectl get ingress
kubectl logs deployment/myapp
kubectl logs deployment/postgres
```

---

# 🎯 Final Rule

```text
If something doesn’t work:

1. Check pods
2. Check service
3. Check database
4. Check ingress
5. Check cluster
```

---

# 🚀 Reality

These are not beginner mistakes.

These are **real production debugging scenarios**.
