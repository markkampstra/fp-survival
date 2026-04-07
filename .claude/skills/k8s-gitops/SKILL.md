---
name: k8s-gitops
description: "Kubernetes deployment and GitOps specialist using k3s, Flux CD, and GitHub Actions. TRIGGER when: setting up CI/CD pipelines, deploying to Kubernetes, configuring k3s clusters, setting up Flux or ArgoCD, creating Dockerfiles, writing GitHub Actions workflows, configuring container registries (GHCR, Docker Hub), writing Kubernetes manifests (Deployments, Services, Ingress), setting up Helm charts, managing secrets with SOPS/sealed-secrets, configuring TLS/cert-manager, or any DevOps/infrastructure task. Also trigger when the user mentions 'deploy', 'CI/CD', 'Docker', 'container', 'k8s', 'kubernetes', 'gitops', 'pipeline', 'hosting', 'production', or wants to make the game accessible online."
---

# Kubernetes & GitOps Deployment Specialist

Expert in lightweight Kubernetes deployments using k3s, Flux CD for GitOps, and GitHub Actions for CI/CD. Focused on deploying browser-based applications (like this Vite/Three.js game) to production.

## Architecture Overview

```
Developer → GitHub (push) → GitHub Actions (CI)
                                 ↓
                          Build & push container image
                                 ↓
                          GitHub Container Registry (GHCR)
                                 ↓
                          Update image tag in Git manifests
                                 ↓
Flux CD (in k3s cluster) ← watches Git repo → reconciles cluster state
                                 ↓
                          k3s runs updated Deployment
                                 ↓
                          Ingress → TLS → User's browser
```

**CI (GitHub Actions):** build, test, containerize, push image
**CD (Flux):** pull-based, watches Git, auto-deploys when manifests change

---

## For This Project (Vite Static Site)

This game builds to static files (`npm run build` → `dist/`). Deployment options:

### Option A: Nginx Container (Recommended)
Serve static files from a tiny nginx container. Simple, fast, cacheable.

### Option B: Node.js SSR Container
Only if server-side features are needed later (multiplayer, auth). Overkill for now.

---

## Step-by-Step Setup

### 1. Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**nginx.conf:**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|gif|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;
    gzip_min_length 1000;
}
```

### 2. GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      - name: Update deployment manifest
        run: |
          sed -i "s|image: .*|image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}|" k8s/deployment.yaml
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add k8s/deployment.yaml
          git commit -m "deploy: update image to ${{ github.sha }}" || true
          git push
```

### 3. Kubernetes Manifests

**k8s/namespace.yaml:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fp-survival
```

**k8s/deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fp-survival
  namespace: fp-survival
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fp-survival
  template:
    metadata:
      labels:
        app: fp-survival
    spec:
      containers:
        - name: web
          image: ghcr.io/markkampstra/fp-survival:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: "32Mi"
              cpu: "10m"
            limits:
              memory: "64Mi"
              cpu: "100m"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
```

**k8s/service.yaml:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: fp-survival
  namespace: fp-survival
spec:
  selector:
    app: fp-survival
  ports:
    - port: 80
      targetPort: 80
```

**k8s/ingress.yaml:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fp-survival
  namespace: fp-survival
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik  # k3s default
  tls:
    - hosts:
        - game.example.com
      secretName: fp-survival-tls
  rules:
    - host: game.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: fp-survival
                port:
                  number: 80
```

### 4. Flux CD Setup

**Install Flux on k3s cluster:**
```bash
# Install flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Bootstrap Flux into your cluster, pointing at your repo
flux bootstrap github \
  --owner=markkampstra \
  --repository=fp-survival \
  --branch=main \
  --path=./k8s \
  --personal
```

This creates Flux controllers in the cluster that watch the `k8s/` directory in your repo. Any changes to manifests in Git are automatically applied to the cluster.

**flux-system/kustomization.yaml** (auto-generated by bootstrap):
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: fp-survival
  namespace: flux-system
spec:
  interval: 5m
  path: ./k8s
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
```

### 5. k3s Cluster Setup

**Single-node (dev/homelab):**
```bash
curl -sfL https://get.k3s.io | sh -
# Kubeconfig at /etc/rancher/k3s/k3s.yaml
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

**Multi-node (production):**
```bash
# Server (control plane)
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --tls-san=<public-ip>

# Get join token
cat /var/lib/rancher/k3s/server/node-token

# Agent (worker nodes)
curl -sfL https://get.k3s.io | K3S_URL=https://<server-ip>:6443 \
  K3S_TOKEN=<token> sh -
```

**k3s includes by default:** Traefik ingress, CoreDNS, local-path storage, metrics-server.

---

## Secrets Management

### SOPS + age (Recommended for GitOps)
Encrypt secrets in Git so they can be version-controlled:
```bash
# Generate age key
age-keygen -o age.agekey

# Create SOPS config
cat > .sops.yaml << EOF
creation_rules:
  - path_regex: k8s/.*secret.*\.yaml
    age: <public-key>
EOF

# Encrypt a secret
sops --encrypt --in-place k8s/secret.yaml

# Flux decrypts automatically with the age key stored as a k8s secret
kubectl create secret generic sops-age \
  --namespace=flux-system \
  --from-file=age.agekey=age.agekey
```

### Sealed Secrets (Alternative)
Uses a cluster-side controller to decrypt:
```bash
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system
kubeseal --format=yaml < secret.yaml > sealed-secret.yaml
```

---

## TLS with cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF
```

---

## Monitoring (Optional)

```bash
# Lightweight monitoring stack for k3s
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set prometheus.prometheusSpec.resources.requests.memory=256Mi \
  --set grafana.resources.requests.memory=128Mi
```

---

## Complete GitOps Flow

1. Developer pushes code to `main`
2. GitHub Actions builds Docker image, pushes to GHCR
3. GitHub Actions updates `k8s/deployment.yaml` with new image tag, commits
4. Flux detects the manifest change (polls every 5 min or via webhook)
5. Flux applies the updated Deployment to k3s
6. k3s rolls out new pods with zero downtime (rolling update)
7. Traefik routes traffic, cert-manager handles TLS

**Rollback:** `git revert` the deployment commit → Flux auto-applies the previous state.

---

## Key References

- [K3s with GitOps guide (2026)](https://oneuptime.com/blog/post/2026-02-02-k3s-gitops/view)
- [Flux homelab with k3s](https://aviitala.com/posts/flux-homelab/)
- [Setup GitOps k3s Flux with SOPS](https://onidel.com/blog/setup-gitops-k3s-flux)
- [Flux CD documentation](https://fluxcd.io/flux/)
- [GitHub Actions Kubernetes guide](https://devtron.ai/blog/create-ci-cd-pipelines-with-github-actions-for-kubernetes-the-definitive-guide/)
- [GitHub Actions + Helm + K8s](https://spacelift.io/blog/github-actions-kubernetes)
- [Deploy blog on k3s with GitOps](https://www.civo.com/learn/using-civo-k3s-service-to-host-your-blog-in-hugo-using-github-actions)
- [FluxCD at scale](https://medium.com/@muppedaanvesh/hands-on-fluxcd-gitops-for-kubernetes-at-scale-%EF%B8%8F-7e3d06ed4c35)
- [Homelab GitOps k3s repo](https://github.com/ahgraber/homelab-gitops-k3s)
