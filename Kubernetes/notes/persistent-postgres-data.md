# Making PostgreSQL Data Persistent

This note explains how PostgreSQL data survives when the Postgres Pod is deleted and recreated.

The key idea:

```text
Pod = temporary
PersistentVolumeClaim = persistent storage request
Postgres data directory = mounted into persistent storage
```

Without persistent storage, the database may lose data when the Pod is replaced. With a PersistentVolumeClaim, the data lives outside the Pod.

---

## What Changed in `postgres.yaml`

The Postgres container mounts storage here:

```yaml
volumeMounts:
  - name: postgres-storage
    mountPath: /var/lib/postgresql/data
```

That path is important because PostgreSQL stores its database files in `/var/lib/postgresql/data`.

The Pod gets that storage from a PersistentVolumeClaim:

```yaml
volumes:
  - name: postgres-storage
    persistentVolumeClaim:
      claimName: postgres-pvc
```

The PVC asks Kubernetes for storage:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce

  resources:
    requests:
      storage: 1Gi
```

In simple words:

```text
postgres-pvc asks for 1Gi storage.
Postgres mounts that storage.
Postgres writes database files into that mounted storage.
If the Pod dies, the PVC still exists.
The new Pod mounts the same storage again.
```

---

## Apply the Manifest

From the Kubernetes app folder:

```bash
cd Kubernetes/hands-on/basic-app/k8s
kubectl apply -f postgres.yaml
```

Check the Pod, Service, and PVC:

```bash
kubectl get pods -l app=postgres
kubectl get svc postgres
kubectl get pvc postgres-pvc
```

Expected PVC state:

```text
postgres-pvc   Bound
```

`Bound` means Kubernetes found or created storage for the claim.

---

## The Only Test That Matters

Do not only trust the YAML. Verify that data actually survives a Pod restart.

The test is:

```text
Insert data.
Delete the Postgres Pod.
Let Kubernetes create a new Pod.
Check if the data still exists.
```

If the data is still there, persistence is working.

---

## Step 1 - Find the Postgres Pod

Run:

```bash
kubectl get pods -l app=postgres
```

Example output:

```text
NAME                        READY   STATUS    RESTARTS   AGE
postgres-866cfb5dbd-9nlc6   1/1     Running   0          2m
```

Your Pod name may be different. Use the name from your own terminal.

---

## Step 2 - Insert Test Data

Connect to PostgreSQL:

```bash
kubectl exec -it deployment/postgres -- psql -U postgres
```

Inside `psql`, create a test table and insert one row:

```sql
CREATE TABLE IF NOT EXISTS test (id SERIAL PRIMARY KEY, name TEXT);
INSERT INTO test (name) VALUES ('ibrahim');
SELECT * FROM test;
```

Expected result:

```text
 id |  name
----+---------
  1 | ibrahim
```

If you already ran this test before, you may see more than one row. That is okay. The important thing is that at least one row with `ibrahim` exists before deleting the Pod.

Exit `psql`:

```sql
\q
```

---

## Step 3 - Delete the Postgres Pod

Get the current Pod name again:

```bash
kubectl get pods -l app=postgres
```

Delete that Pod:

```bash
kubectl delete pod <postgres-pod-name>
```

Example:

```bash
kubectl delete pod postgres-866cfb5dbd-9nlc6
```

Kubernetes will recreate the Pod because the Postgres Deployment still says:

```text
I want 1 Postgres Pod running.
```

Wait until the new Pod is running:

```bash
kubectl get pods -l app=postgres
```

Expected:

```text
postgres-...   1/1   Running
```

---

## Step 4 - Reconnect and Check the Data

Connect again:

```bash
kubectl exec -it deployment/postgres -- psql -U postgres
```

Run:

```sql
SELECT * FROM test;
```

Expected result:

```text
 id |  name
----+---------
  1 | ibrahim
```

If you ran the insert more than once, the `id` number may be different or there may be multiple rows. That is still fine. The important part is that `ibrahim` still exists after the Pod was deleted and recreated.

If `ibrahim` is still there, you win:

```text
Storage is persistent.
The system is stateful.
The new Pod reused the old database files.
```

Exit:

```sql
\q
```

---

## If the Data Is Missing

Check these things:

```bash
kubectl get pvc postgres-pvc
kubectl describe pvc postgres-pvc
kubectl describe pod -l app=postgres
```

Common causes:

- The PVC is not `Bound`
- The Postgres volume is not mounted at `/var/lib/postgresql/data`
- The Pod is using a different claim name than `postgres-pvc`
- The PVC was deleted, which can delete or detach the underlying storage depending on the cluster

---

## Important Warning

Deleting the Pod should not delete the data.

Deleting the PVC is different:

```bash
kubectl delete pvc postgres-pvc
```

That can delete the storage depending on the cluster and StorageClass. For this learning app, delete Pods freely while testing, but be careful with deleting PVCs.

---

## Production Note

For learning, a Deployment with a PVC is okay.

For production databases, prefer a database operator, a managed database service, or a StatefulSet with carefully designed storage, backups, restores, monitoring, and upgrade plans.
