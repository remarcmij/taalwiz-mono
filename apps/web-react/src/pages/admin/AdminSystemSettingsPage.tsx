import {
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { useSettings, useUpdateSettings } from '../../api/admin.api.ts';
import BackButton from '../../components/BackButton.tsx';
import type { ISystemSettings } from '../../types/models.ts';

function deepEqual(a: ISystemSettings[], b: ISystemSettings[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const AdminSystemSettingsPage: React.FC = () => {
  const { data: serverSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [localSettings, setLocalSettings] = useState<ISystemSettings[]>([]);
  const originalRef = useRef<ISystemSettings[]>([]);
  const localRef = useRef<ISystemSettings[]>([]);

  // Sync server settings into local state
  useEffect(() => {
    if (serverSettings) {
      const sorted = [...serverSettings].sort(
        (a, b) => a.sortIndex - b.sortIndex,
      );
      setLocalSettings(sorted);
      originalRef.current = sorted;
    }
  }, [serverSettings]);

  // Keep ref in sync for cleanup
  useEffect(() => {
    localRef.current = localSettings;
  }, [localSettings]);

  // Auto-save on unmount if dirty
  useEffect(() => {
    return () => {
      if (!deepEqual(originalRef.current, localRef.current)) {
        updateSettings.mutate(localRef.current, {
          onError: (err) =>
            console.error('Failed to save settings:', err),
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (
    index: number,
    field: keyof ISystemSettings,
    value: string | number | boolean,
  ) => {
    setLocalSettings((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const renderSettingInput = (setting: ISystemSettings, index: number) => {
    switch (setting.valueType) {
      case 'string':
        return (
          <IonItem key={setting._id}>
            <IonInput
              label={setting.label}
              labelPlacement="stacked"
              value={setting.stringVal ?? ''}
              onIonInput={(e) =>
                updateField(index, 'stringVal', e.detail.value ?? '')
              }
            />
          </IonItem>
        );

      case 'number':
        return (
          <IonItem key={setting._id}>
            <IonInput
              label={setting.label}
              labelPlacement="stacked"
              type="number"
              value={setting.numberVal ?? 0}
              onIonInput={(e) =>
                updateField(
                  index,
                  'numberVal',
                  parseFloat(e.detail.value ?? '0') || 0,
                )
              }
            />
          </IonItem>
        );

      case 'boolean':
        return (
          <IonItem key={setting._id}>
            <IonLabel>{setting.label}</IonLabel>
            <IonToggle
              checked={setting.booleanVal ?? false}
              onIonChange={(e) =>
                updateField(index, 'booleanVal', e.detail.checked)
              }
            />
          </IonItem>
        );

      case 'date':
        return (
          <IonItem key={setting._id}>
            <IonLabel position="stacked">{setting.label}</IonLabel>
            <IonDatetime
              presentation="date"
              value={
                setting.dateVal
                  ? new Date(setting.dateVal).toISOString()
                  : undefined
              }
              onIonChange={(e) => {
                const val = e.detail.value;
                if (typeof val === 'string') {
                  updateField(index, 'dateVal', new Date(val).toISOString());
                }
              }}
            />
          </IonItem>
        );

      default:
        return null;
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar color="tertiary">
          <IonButtons slot="start">
            <BackButton defaultHref="/admin" />
          </IonButtons>
          <IonTitle>System Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="content-container">
          {isLoading && (
            <div className="ion-text-center ion-padding">
              <IonSpinner />
            </div>
          )}
          <IonList>
            {localSettings.map((setting, index) =>
              renderSettingInput(setting, index),
            )}
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSystemSettingsPage;
