import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonPage,
  IonProgressBar,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  alertOutline,
  checkmarkOutline,
  closeOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../hooks/useAuth.ts';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface QueueItem {
  file: File;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
}

const formatSize = (bytes: number): string => {
  return (bytes / 1024).toFixed(1) + ' KB';
};

const statusIcon = (status: UploadStatus) => {
  switch (status) {
    case 'success':
      return checkmarkOutline;
    case 'error':
      return alertOutline;
    default:
      return undefined;
  }
};

const statusColor = (status: UploadStatus) => {
  switch (status) {
    case 'success':
      return 'success';
    case 'error':
      return 'danger';
    default:
      return 'medium';
  }
};

const AdminUploadPage: React.FC = () => {
  const { getAccessToken } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const xhrRefs = useRef<XMLHttpRequest[]>([]);

  // Abort active uploads on unmount
  useEffect(() => {
    return () => {
      for (const xhr of xhrRefs.current) {
        xhr.abort();
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: QueueItem[] = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as UploadStatus,
      progress: 0,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'text/markdown': ['.md'],
      'application/json': ['.json'],
    },
  });

  const updateQueueItem = (
    index: number,
    update: Partial<QueueItem>,
  ) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...update } : item)),
    );
  };

  const uploadFile = async (
    item: QueueItem,
    index: number,
    token: string,
  ): Promise<void> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRefs.current.push(xhr);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          updateQueueItem(index, { progress, status: 'uploading' });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updateQueueItem(index, { status: 'success', progress: 1 });
        } else {
          let errorMessage = 'Upload failed';
          try {
            const body = JSON.parse(xhr.responseText) as {
              message?: string;
            };
            if (body.message) errorMessage = body.message;
          } catch {
            // ignore parse errors
          }
          updateQueueItem(index, { status: 'error', errorMessage });
        }
        resolve();
      };

      xhr.onerror = () => {
        updateQueueItem(index, {
          status: 'error',
          errorMessage: 'Network error',
        });
        resolve();
      };

      xhr.onabort = () => {
        updateQueueItem(index, { status: 'pending', progress: 0 });
        resolve();
      };

      const formData = new FormData();
      formData.append('file', item.file);

      xhr.open('POST', '/api/v1/content/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  const handleUploadAll = async () => {
    const token = await getAccessToken();
    if (!token) return;

    setIsUploading(true);
    setOverallProgress(0);
    xhrRefs.current = [];

    const pendingIndices = queue
      .map((item, i) => (item.status === 'pending' ? i : -1))
      .filter((i) => i !== -1);

    for (let i = 0; i < pendingIndices.length; i++) {
      const idx = pendingIndices[i]!;
      await uploadFile(queue[idx]!, idx, token);
      setOverallProgress((i + 1) / pendingIndices.length);
    }

    setIsUploading(false);
    xhrRefs.current = [];
  };

  const handleCancelAll = () => {
    for (const xhr of xhrRefs.current) {
      xhr.abort();
    }
    xhrRefs.current = [];
    setIsUploading(false);
    setOverallProgress(0);
  };

  const handleClearQueue = () => {
    if (!isUploading) {
      setQueue([]);
      setOverallProgress(0);
    }
  };

  const removeItem = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const hasPending = queue.some((item) => item.status === 'pending');

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <IonBackButton text="" defaultHref="/admin" />
          </IonButtons>
          <IonTitle>Upload Content</IonTitle>
        </IonToolbar>
        {isUploading && <IonProgressBar value={overallProgress} />}
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          <div className="ion-padding">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            style={{
              border: '2px dashed var(--ion-color-medium)',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive
                ? 'var(--ion-color-light)'
                : 'transparent',
              transition: 'background-color 0.2s',
            }}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop files here...</p>
            ) : (
              <p>Drag & drop files here, or click to select files</p>
            )}
          </div>

          {/* Action buttons */}
          {queue.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <IonButton
                size="small"
                onClick={handleUploadAll}
                disabled={isUploading || !hasPending}
              >
                Upload All
              </IonButton>
              {isUploading && (
                <IonButton
                  size="small"
                  color="warning"
                  onClick={handleCancelAll}
                >
                  Cancel All
                </IonButton>
              )}
              <IonButton
                size="small"
                color="medium"
                onClick={handleClearQueue}
                disabled={isUploading}
              >
                Clear Queue
              </IonButton>
            </div>
          )}

          {/* Upload queue */}
          {queue.length > 0 && (
            <IonGrid style={{ marginTop: '1rem' }}>
              {queue.map((item, index) => (
                <IonRow
                  key={`${item.file.name}-${index}`}
                  className="ion-align-items-center"
                  style={{
                    borderBottom: '1px solid var(--ion-color-light)',
                    padding: '8px 0',
                  }}
                >
                  <IonCol size="5">
                    <strong>{item.file.name}</strong>
                  </IonCol>
                  <IonCol size="2">{formatSize(item.file.size)}</IonCol>
                  <IonCol size="3">
                    {item.status === 'uploading' && (
                      <IonProgressBar value={item.progress} />
                    )}
                    {item.status !== 'uploading' && (
                      <span
                        style={{
                          color: `var(--ion-color-${statusColor(item.status)})`,
                          fontSize: '0.85em',
                        }}
                      >
                        {item.status === 'error'
                          ? item.errorMessage ?? 'Error'
                          : item.status}
                      </span>
                    )}
                  </IonCol>
                  <IonCol size="2" className="ion-text-end">
                    {statusIcon(item.status) && (
                      <IonIcon
                        icon={statusIcon(item.status)}
                        color={statusColor(item.status)}
                        style={{ fontSize: '1.2em', marginRight: '8px' }}
                      />
                    )}
                    {!isUploading && (
                      <IonIcon
                        icon={closeOutline}
                        style={{ cursor: 'pointer', fontSize: '1.2em' }}
                        onClick={() => removeItem(index)}
                      />
                    )}
                  </IonCol>
                </IonRow>
              ))}
            </IonGrid>
          )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminUploadPage;
