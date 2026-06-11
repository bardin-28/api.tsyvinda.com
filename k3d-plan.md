# Development Roadmap

## Goal

Построить современную инфраструктуру для SaaS-приложения с использованием:

* NestJS
* Next.js
* PostgreSQL
* Kubernetes
* AWS
* Terraform
* GitHub Actions
* Prometheus
* Grafana

При этом:

* локальная разработка должна работать через K3d;
* production должен использовать K3s;
* архитектура должна быть совместима с будущей миграцией на EKS.

---

# Phase 1 - Backend Foundation

## Objective

Подготовить backend для контейнеризации и запуска в Kubernetes.

## Tasks

### Create Backend Repository

```text
backend/
```

### Setup

* NestJS
* TypeScript
* ESLint
* Prettier
* Husky
* Commitlint

### Configure Database

* PostgreSQL
* Prisma ORM

### Configure Docker

Создать:

```text
Dockerfile
.dockerignore
docker-compose.yml
```

### Verify

```bash
docker build .
docker run ...
```

Backend должен запускаться локально в контейнере.

---

# Phase 2 - Local Kubernetes Environment

## Objective

Развернуть локальный Kubernetes.

## Tasks

### Install

* Docker Desktop
* kubectl
* Helm
* K3d

### Create Local Cluster

```bash
k3d cluster create dev
```

### Verify

```bash
kubectl get nodes
```

---

# Phase 3 - Backend Kubernetes Deployment

## Objective

Запуск backend внутри Kubernetes.

## Tasks

### Create Helm Chart

```text
helm/backend
```

### Create Resources

* Deployment
* Service
* ConfigMap
* Secret

### Deploy

```bash
helm install backend
```

### Verify

Backend доступен внутри K3d.

---

# Phase 4 - Local Infrastructure

## Objective

Поднять локальные зависимости.

## Tasks

### PostgreSQL

Использовать Helm Chart или Docker Container.

### MinIO

Использовать как локальную замену S3.

### Redis

Для кеширования и фоновых задач.

### Ingress Nginx

Настроить маршрутизацию.

---

# Phase 5 - Infrastructure Repository

## Objective

Создать отдельный репозиторий инфраструктуры.

## Repository

```text
infrastructure/
```

### Structure

```text
infrastructure
├── terraform
├── kubernetes
├── helm
├── scripts
└── docs
```

---

# Phase 6 - Terraform Foundation

## Objective

Автоматическое создание инфраструктуры AWS.

## Resources

### Networking

* VPC
* Public Subnets
* Private Subnets
* Route Tables

### Security

* Security Groups
* IAM Roles

### Storage

* S3

### Database

* RDS PostgreSQL

### Compute

* EC2

### Networking

* Elastic IP

---

# Phase 7 - Production K3s Cluster

## Objective

Развернуть production Kubernetes.

## Tasks

### Provision

Terraform создаёт:

* EC2
* Security Groups
* Elastic IP

### Bootstrap

Установить:

* K3s
* Helm
* kubectl

### Verify

```bash
kubectl get nodes
```

---

# Phase 8 - CI/CD

## Objective

Автоматический деплой приложений.

## GitHub Actions

### Backend

Pipeline:

```text
Push
 ↓
Lint
 ↓
Tests
 ↓
Build Docker Image
 ↓
Push Image
 ↓
Deploy
```

### Registry

Использовать:

* Amazon ECR

---

# Phase 9 - Monitoring

## Objective

Добавить наблюдаемость.

## Install

### Prometheus

Метрики:

* CPU
* RAM
* Requests
* Latency

### Grafana

Дашборды:

* Infrastructure
* Application

### Alertmanager

Уведомления:

* Telegram
* Email

### Loki

Централизованные логи.

---

# Phase 10 - Frontend

## Objective

Подключить frontend к существующей платформе.

## Create Repository

```text
frontend/
```

### Setup

* Next.js
* TypeScript
* ESLint
* Prettier

### Docker

Создать Dockerfile.

### Kubernetes

Создать Helm Chart:

```text
helm/frontend
```

### Deploy

```bash
helm install frontend
```

---

# Phase 11 - Ingress

## Objective

Настроить маршрутизацию.

## Routes

```text
/       -> frontend
/api    -> backend
```

## SSL

Использовать:

* Cloudflare
* Let's Encrypt

---

# Phase 12 - Production Hardening

## Objective

Подготовить систему к росту нагрузки.

## Kubernetes

* Resource Requests
* Resource Limits
* Liveness Probe
* Readiness Probe

## Database

* Automated Backups
* Connection Pooling

## Monitoring

* Alerts
* Error Tracking

## Security

* Secrets Management
* IAM Policies
* Branch Protection Rules

---

# Future Improvements

## GitOps

Добавить:

* ArgoCD

## Kubernetes

Добавить:

* Horizontal Pod Autoscaler

## AWS

При росте нагрузки выполнить миграцию:

```text
K3d
 ↓
K3s
 ↓
EKS
```

Без изменения приложения.

---

# Final Target Architecture

```text
Cloudflare
     |
Load Balancer
     |
Ingress Nginx
     |
+----------------------+
|        K3s           |
|----------------------|
| Frontend             |
| Backend              |
| Prometheus           |
| Grafana              |
| Loki                 |
| Alertmanager         |
+----------------------+
      |          |
      |          |
    RDS         S3
(Postgres)   (Storage)
```
