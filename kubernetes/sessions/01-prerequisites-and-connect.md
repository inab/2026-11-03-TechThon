# Session 1: prerequisites and connecting to Kubernetes

[Index](../WORKSHOP.md) · Next: [Session 2: deploy with YAML](02-deploy-with-yaml.md)

**Goal:** have the tools installed and reach your namespace on the cluster.

## Before the workshop

You need:
- **`kubectl`**, the Kubernetes command line, version 1.33–1.35
- **`helm`**, version 3 or 4
- Chrome or Firefox
- the **BSC VPN**

### Install kubectl


```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo mkdir -p -m 755 /etc/apt/keyrings

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.34/deb/Release.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

sudo chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.34/deb/ /' \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list


sudo apt-get update
sudo apt-get install -y kubectl

```

### Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```
Check both:

```bash
kubectl version --client
helm version
```

## What you get

- your **kubeconfig file** (`YOUR_USERNAME.kubeconfig`): access to the cluster, valid for the event only. Keep it private: it holds your token.
- the **Keycloak settings**: address, realm, client ID, client secret
- a **Keycloak user and password**

In all the guides, replace `YOUR_USERNAME` with your own name: lowercase
letters, numbers and dashes, for example `yasir`. Your app will run at
`https://techbiolab.dev.bsc.es/YOUR_USERNAME/`.


How you reach the cluster: your laptop → BSC VPN → the bastion VM
(`k8-login`) → the cluster's API. The VPN only lets ports 22, 80 and 443
through, so the API is reached on port 443.

## Connect

Turn on the VPN, then:

```bash
export KUBECONFIG=~/YOUR_USERNAME.kubeconfig      
kubectl get pods
```

`No resources found in techthon namespace.` means it works.

## Look around

```bash
kubectl config get-contexts              # which cluster, user and namespace you use
kubectl auth whoami                      # who the cluster thinks you are
kubectl auth can-i create deployments    # yes, in techthon
kubectl auth can-i create deployments -n default   # no: only your namespace
kubectl get pods,deployments,services,ingresses    # what's running in techthon
kubectl get resourcequota,limitrange     # the namespace's limits
kubectl explain pod                      # built-in documentation for any object
```

