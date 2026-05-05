# CI/CD Notes

This folder explains the CI/CD setup for this repository.

CI/CD means:

```text
CI = Continuous Integration
CD = Continuous Deployment / Delivery
```

In this project, GitHub Actions now builds the backend Docker image, pushes it to Docker Hub, connects to Google Kubernetes Engine, and applies the Kubernetes manifests.

---

## What Was Added

A GitHub Actions workflow exists here:

```text
.github/workflows/deploy.yaml
```

The workflow is named:

```yaml
name: Build and Deploy to GKE
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

The job also requests these permissions:

```yaml
permissions:
  contents: read
  id-token: write
```

`contents: read` lets the workflow read the repository code.

`id-token: write` lets GitHub Actions request an OpenID Connect token, which is required for Google Cloud Workload Identity Federation.

---

## Step 1 - Checkout Code

```yaml
- name: Checkout
  uses: actions/checkout@v4
```

This downloads your repository code into the GitHub Actions runner.

Without this step, the pipeline would not have access to your Dockerfile, backend code, or Kubernetes YAML files.

---

## Step 2 - Authenticate to Google Cloud

```yaml
- name: Authenticate to GCP
  uses: google-github-actions/auth@v2
```

The workflow uses Workload Identity Federation instead of storing a Google Cloud service account key file in GitHub.

It expects these GitHub Secrets:

| Secret Name | Purpose |
| ----------- | ------- |
| `PROJECT_NUMBER` | Google Cloud project number used in the Workload Identity Provider path |
| `PROJECT_ID` | Google Cloud project ID used for the service account and GKE commands |

The workflow authenticates as this service account:

```text
github-actions@<PROJECT_ID>.iam.gserviceaccount.com
```

The Workload Identity Provider path is:

```text
projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

---

## Step 3 - Set Up `gcloud`

```yaml
- name: Setup gcloud
  uses: google-github-actions/setup-gcloud@v2
```

This installs and configures the Google Cloud CLI on the GitHub Actions runner.

The workflow then installs the GKE authentication plugin:

```yaml
gcloud components install gke-gcloud-auth-plugin --quiet
```

This plugin allows `kubectl` to authenticate to GKE using Google Cloud credentials.

---

## Step 4 - Get GKE Credentials

```yaml
gcloud container clusters get-credentials devops-cluster \
  --region asia-south1 \
  --project ${{ secrets.PROJECT_ID }}
```

This connects the GitHub Actions runner to the GKE cluster.

Current cluster settings:

| Setting | Value |
| ------- | ----- |
| Cluster name | `devops-cluster` |
| Region | `asia-south1` |
| Project | `${{ secrets.PROJECT_ID }}` |

After this step, `kubectl` can apply manifests to the GKE cluster.

---

## Step 5 - Login to Docker Hub

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
```

This logs in to Docker Hub using GitHub Secrets:

```yaml
username: ${{ secrets.DOCKER_USERNAME }}
password: ${{ secrets.DOCKER_PASSWORD }}
```

Required Docker Hub secrets:

| Secret Name | Purpose |
| ----------- | ------- |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |

For Docker Hub, an access token is better than using your real account password.

---

## Step 6 - Build Docker Image

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

## Step 7 - Push Docker Image

```yaml
docker push ${{ secrets.DOCKER_USERNAME }}/myapp:latest
```

This uploads the image to Docker Hub.

After this step, the image is available to the GKE cluster.

---

## Step 8 - Deploy to Kubernetes

The workflow applies each Kubernetes manifest:

```yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/configmap.yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/secret.yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/postgres.yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/deployment.yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/service.yaml
kubectl apply -f Kubernetes/hands-on/basic-app/k8s/ingress.yaml
```

Then it restarts the application deployment:

```yaml
kubectl rollout restart deployment myapp
```

This makes Kubernetes pull and run the latest `myapp:latest` image.

---

## Step 9 - Verify Deployment

```yaml
kubectl rollout status deployment myapp
```

This waits for the `myapp` deployment rollout to complete.

If the rollout fails, the GitHub Actions workflow fails too.

---

## Required GitHub Secrets

Store these values in:

```text
Repository -> Settings -> Secrets and variables -> Actions
```

| Secret Name | Purpose |
| ----------- | ------- |
| `PROJECT_ID` | Google Cloud project ID |
| `PROJECT_NUMBER` | Google Cloud project number |
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |

No `KUBE_CONFIG` secret is required in the current workflow because the pipeline connects to GKE through Google Cloud authentication.

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
Authenticate to Google Cloud with Workload Identity Federation
        |
        v
Set up gcloud and install the GKE auth plugin
        |
        v
Get credentials for devops-cluster in asia-south1
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
Apply Kubernetes manifests to GKE
        |
        v
Restart and verify the myapp deployment
```

---

## Important Notes

This pipeline deploys to Google Kubernetes Engine, not to a local Kind cluster.

Kind runs on your local machine. GitHub Actions runs on GitHub's machine. GitHub Actions cannot directly deploy to your local Kind cluster unless you add a special connection mechanism.

The current CD flow is real:

```text
Push to master -> Build image -> Push to Docker Hub -> Deploy to GKE
```

---

## Mental Model

For this repository:

```text
GitHub Actions is the automation engine.
Docker Hub stores the application image.
Google Cloud authenticates the workflow.
GKE runs the Kubernetes workload.
kubectl applies the manifests and checks the rollout.
```
