# CI/CD Notes

This folder explains the CI/CD setup for this repository.

CI/CD means:

```text
CI = Continuous Integration
CD = Continuous Deployment / Delivery
```

In simple words:

```text
When you push code to GitHub,
GitHub Actions can automatically build your app,
push the Docker image,
and later deploy it to Kubernetes.
```

---

## What Was Added

A GitHub Actions workflow was added here:

```text
.github/workflows/deploy.yaml
```

This workflow is named:

```yaml
name: Build and Deploy to Kubernetes
```

It runs when code is pushed to the `master` branch:

```yaml
on:
  push:
    branches:
      - master
```

So the trigger is:

```text
Push to master -> GitHub Actions starts the pipeline
```

---

## What the Pipeline Does

The workflow has one job:

```yaml
build-deploy
```

That job runs on a GitHub-hosted Ubuntu machine:

```yaml
runs-on: ubuntu-latest
```

Think of this as a temporary computer created by GitHub just to run your pipeline.

---

## Step 1 - Checkout Code

```yaml
- name: Checkout code
  uses: actions/checkout@v4
```

This downloads your repository code into the GitHub Actions runner.

Without this step, the pipeline would not have access to your files.

---

## Step 2 - Login to Docker Hub

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
```

This logs in to Docker Hub using GitHub Secrets:

```yaml
username: ${{ secrets.DOCKER_USERNAME }}
password: ${{ secrets.DOCKER_PASSWORD }}
```

These values should not be written directly in the workflow file.

They must be stored in GitHub:

```text
Repository -> Settings -> Secrets and variables -> Actions
```

Required secrets:

| Secret Name | Purpose |
| ----------- | ------- |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |

For Docker Hub, an access token is better than using your real account password.

---

## Step 3 - Build Docker Image

```yaml
docker build -t ${{ secrets.DOCKER_USERNAME }}/myapp:latest ./Kubernetes/hands-on/basic-app/backend
```

This builds the Node.js backend Docker image from:

```text
Kubernetes/hands-on/basic-app/backend
```

The image name becomes:

```text
<docker-username>/myapp:latest
```

Example:

```text
ibrahim/myapp:latest
```

---

## Step 4 - Push Docker Image

```yaml
docker push ${{ secrets.DOCKER_USERNAME }}/myapp:latest
```

This uploads the image to Docker Hub.

After this step, the image is available outside your local machine.

That matters because a remote Kubernetes cluster cannot use images that only exist on your laptop.

---

## Step 5 - Set Up `kubectl`

```yaml
- name: Set up kubectl
  uses: azure/setup-kubectl@v4
```

This installs `kubectl` in the GitHub Actions runner.

`kubectl` is the command-line tool used to talk to Kubernetes.

---

## Step 6 - Prepare Kubeconfig

```yaml
echo "${{ secrets.KUBE_CONFIG }}" > kubeconfig
export KUBECONFIG=$PWD/kubeconfig
```

The idea is to store Kubernetes cluster access inside a GitHub Secret named:

```text
KUBE_CONFIG
```

This secret would contain the kubeconfig file for a real Kubernetes cluster.

Important: kubeconfig is sensitive. Anyone with that file may be able to control your cluster, depending on its permissions.

---

## Step 7 - Deploy Step Is Skipped For Now

Right now, the real deploy command is commented out:

```yaml
# kubectl apply -f Kubernetes/hands-on/basic-app/k8s/
# kubectl rollout restart deployment myapp
```

The workflow currently runs this instead:

```yaml
echo "Deployment skipped - no remote cluster configured"
```

That means the current pipeline does this:

```text
Build Docker image -> Push image to Docker Hub -> Stop before real deployment
```

This is okay for now because you do not have a remote Kubernetes cluster connected yet.

---

## Current Pipeline Flow

```text
Developer pushes code to master
        |
        v
GitHub Actions starts
        |
        v
Checkout repository
        |
        v
Login to Docker Hub
        |
        v
Build backend Docker image
        |
        v
Push image to Docker Hub
        |
        v
Set up kubectl
        |
        v
Deployment skipped for now
```

---

## Important Beginner Notes

This pipeline does not deploy to your local Kind cluster.

Kind runs on your local machine. GitHub Actions runs on GitHub's machine. GitHub cannot automatically access your local Kind cluster.

That is why the next real step is to use a cloud Kubernetes cluster.

---

## Next Step - Deploy to Google Cloud Platform

The next step will be to deploy this app to Google Cloud Platform.

Most likely, that means using:

```text
Google Kubernetes Engine
```

GKE is Google Cloud's managed Kubernetes service.

The future flow will look like this:

```text
Push code to GitHub
GitHub Actions builds Docker image
GitHub Actions pushes image to a registry
GitHub Actions connects to GKE
GitHub Actions applies Kubernetes YAML files
App runs on Google Cloud Platform
```

At that point, the skipped deploy step can become a real deploy step.

---

## Mental Model

For now:

```text
CI is mostly working.
CD is prepared, but not connected to a real cluster yet.
```

Next:

```text
Connect GitHub Actions to Google Cloud Platform.
Deploy Kubernetes manifests to GKE.
```
