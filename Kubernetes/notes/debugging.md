# 🔍 Kubernetes Debugging Guide

This document provides a **systematic approach to debugging Kubernetes issues**.

---

# 🧠 Core Principle

Never guess.

Always debug in layers:

```text
Cluster → Ingress → Service → Pods → Container
````

---

# 🧭 End-to-End Request Flow

<svg width="850" height="180" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="60" width="120" height="50" fill="#e3f2fd"/>
  <text x="20" y="90">Browser</text>
  <rect x="150" y="60" width="160" height="50" fill="#e8f5e9"/>
  <text x="165" y="90">Ingress (Nginx)</text>
  <rect x="330" y="60" width="130" height="50" fill="#fff3e0"/>
  <text x="345" y="90">Service</text>
  <rect x="480" y="40" width="110" height="40" fill="#f3e5f5"/>
  <text x="495" y="65">Pod</text>
  <rect x="610" y="40" width="110" height="40" fill="#ede7f6"/>
  <text x="625" y="65">Container</text>
  <line x1="130" y1="85" x2="150" y2="85" stroke="black"/>
  <line x1="310" y1="85" x2="330" y2="85" stroke="black"/>
  <line x1="460" y1="85" x2="480" y2="60" stroke="black"/>
  <line x1="590" y1="60" x2="610" y2="60" stroke="black"/>
</svg>

---

# 🔍 Step-by-Step Debugging Workflow

---

## 🧱 Step 1 — Check Cluster

```bash
kubectl cluster-info
kubectl get nodes
```

### ✅ Expected

```text
control-plane   Ready
```

---

## 🧱 Step 2 — Check Ingress Controller

```bash
kubectl get pods -n ingress-nginx
```

### ✅ Expected

```text
ingress-nginx-controller   Running
```

---

## 🧱 Step 3 — Check Ingress Resource

```bash
kubectl get ingress
kubectl describe ingress myapp-ingress
```

### Verify:

* Host is correct
* Service name is correct

---

## 🧱 Step 4 — Check Service

```bash
kubectl get svc
kubectl describe svc myapp-service
```

---

## 🧱 Step 5 — Check Endpoints (CRITICAL)

```bash
kubectl get endpoints
```

---

### ❌ If:

```text
<none>
```

👉 Service is not connected to any pods

---

## 🧱 Step 6 — Check Pods

```bash
kubectl get pods
```

---

### Common States

| Status           | Meaning          |
| ---------------- | ---------------- |
| Running          | OK               |
| ImagePullBackOff | Image issue      |
| CrashLoopBackOff | App crashing     |
| Pending          | Scheduling issue |

---

## 🧱 Step 7 — Describe Pod

```bash
kubectl describe pod <pod-name>
```

### Look at:

```text
Events section
```

---

## 🧱 Step 8 — Check Logs

```bash
kubectl logs <pod-name>
```

---

## 🧱 Step 9 — Test Service Directly

```bash
kubectl port-forward svc/myapp-service 8081:80
```

Open:

```text
http://localhost:8081
```

---

👉 Helps isolate:

* Backend issue vs ingress issue

---

# 🔬 Advanced Debugging Techniques

---

## 🔍 Exec into Pod

```bash
kubectl exec -it <pod-name> -- sh
```

---

### Test inside container

```bash
curl localhost:3000
```

---

## 🔍 Check Environment Variables

```bash
printenv
```

---

## 🔍 Check Networking

```bash
kubectl get svc
kubectl get endpoints
```

---

# 🧠 Debugging Scenarios

---

## 🚨 Scenario 1 — 503 Error

```text
Ingress OK → Service has no endpoints
```

👉 Check:

```bash
kubectl get endpoints
```

---

## 🚨 Scenario 2 — ImagePullBackOff

```text
Image not available
```

👉 Fix:

```bash
kind load docker-image myapp:v1
```

---

## 🚨 Scenario 3 — Pod Running but Not Ready

```text
READY 0/1
```

👉 Cause:

* Readiness probe failing

---

## 🚨 Scenario 4 — ContainerCreating

👉 Check:

```bash
kubectl describe pod
```

---

## 🚨 Scenario 5 — No Response in Browser

Check flow:

```text
Browser → Ingress → Service → Pod
```

Breakpoint where it fails.

---

# 🧠 Debugging Strategy (Golden Rule)

```text
Start from top → move downward
```

OR

```text
Start from pods → move upward
```

---

# 🔁 Reverse Debugging (Power Technique)

If browser fails:

```text
1. Test ingress
2. Test service (port-forward)
3. Test pod (exec + curl)
```

---

# 🧠 Mental Model

```text
If Pods ❌ → nothing works
If Service ❌ → ingress fails
If Ingress ❌ → external access fails
```

---

# 🎯 Debug Command Cheat Sheet

```bash
kubectl get pods
kubectl describe pod <pod>
kubectl logs <pod>

kubectl get svc
kubectl get endpoints

kubectl get ingress
kubectl describe ingress

kubectl get nodes
kubectl cluster-info
```

---

# 🚀 Final Thought

Debugging Kubernetes is not about guessing.

It is about:

```text
Tracing the request path and finding where it breaks
```
