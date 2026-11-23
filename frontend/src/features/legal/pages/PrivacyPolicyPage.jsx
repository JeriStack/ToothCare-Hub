import React, { useEffect, useState } from 'react';
import legalApi from '../api';
import { FALLBACK_PRIVACY_POLICY } from '../data/legalFallbackContent';
import { LegalDocumentLayout } from '../components/LegalDocumentLayout';

export function PrivacyPolicyPage(props) {
  const [doc, setDoc] = useState(FALLBACK_PRIVACY_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    legalApi
      .getPrivacyPolicy({ background: true })
      .then((data) => {
        if (active && data && data.content?.sections) {
          setDoc(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <LegalDocumentLayout
      {...props}
      activeType="PRIVACY_POLICY"
      documentData={doc}
      isLoading={isLoading}
      loadError={loadError}
    />
  );
}

export default PrivacyPolicyPage;
