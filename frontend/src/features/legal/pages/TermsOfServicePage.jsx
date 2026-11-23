import React, { useEffect, useState } from 'react';
import legalApi from '../api';
import { FALLBACK_TERMS_OF_SERVICE } from '../data/legalFallbackContent';
import { LegalDocumentLayout } from '../components/LegalDocumentLayout';

export function TermsOfServicePage(props) {
  const [doc, setDoc] = useState(FALLBACK_TERMS_OF_SERVICE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    legalApi
      .getTermsOfService({ background: true })
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
      activeType="TERMS_OF_SERVICE"
      documentData={doc}
      isLoading={isLoading}
      loadError={loadError}
    />
  );
}

export default TermsOfServicePage;
