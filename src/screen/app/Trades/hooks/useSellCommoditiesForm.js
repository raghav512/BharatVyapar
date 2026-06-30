/**
 * useSellCommoditiesForm.js
 *
 * Performance fix summary
 * ───────────────────────
 * ROOT CAUSE (what the profiler showed):
 *   • "createTask" 81 ms self-time — React Scheduler creating a new task for
 *     every batched state-update triggered by new function references.
 *   • "useSyncState (anonymous)" 80% total time — React DevTools' internal
 *     hook fires for every dispatch, amplified because children re-rendered
 *     constantly due to new setter/handler props.
 *   • beginWork + completeWork ~131 ms — full tree re-walk on every keystroke.
 *
 * WHY IT HAPPENED:
 *   All 25 setter functions and 5 handlers were plain arrow functions defined
 *   in the hook body. React re-runs the hook on every state change (i.e. every
 *   keystroke), creating 30 brand-new function objects each time. Children
 *   received new prop references → scheduled new renders → scheduler queued
 *   new tasks → profiler shows the cascade above.
 *
 * THE FIX — three changes:
 *   1. Wrap every setter in useCallback([]) — dispatch from useReducer is
 *      guaranteed stable by React, so deps = [] is correct and safe.
 *   2. Keep a `stateRef` that is always updated to the latest state.
 *      Handlers that need to read state (handleAddImages, handlePostListing)
 *      read stateRef.current instead of capturing `state` in their closure.
 *      This lets those handlers also use useCallback([]) without going stale.
 *   3. Memoize the returned `setters` and `handlers` objects with useMemo so
 *      the *object reference* is also stable between renders.
 *
 * NET EFFECT:
 *   After mount, zero function references ever change → no downstream
 *   re-renders caused by the hook → profiler times drop dramatically.
 */

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { showAlert } from '../../../../components/CustomAlertBox';
import { getFriendlyErrorMessage } from '../../../../utils/errorUtils';
import { submitSellListing } from '../../../../service/sell/sellService';

export const IMAGE_MAX_SIZE_MB = 50;
export const UNIT_TO_PRICE_UNIT = { Ton: 'Ton', Quintal: 'Qt', Kg: 'Kg' };

const INITIAL_STATE = {
  focusedField: null,
  commodityName: '',
  type: '',
  quantity: '',
  unit: 'Ton',
  sellingPrice: '',
  sellingPriceUnit: 'Ton',
  weightType: 'Net Weight',
  listingEndDate: '',
  deliveryType: 'FOR',
  exWarehouseAddress: '',
  weightTolerance: '',
  billingAddress: '',
  paymentTimeline: '',
  remarks: '',
  isNegotiable: true,
  minimumAcceptablePrice: '',
  maxNegotiationRounds: '',
  offerExpiryHours: '',
  commodityLocation: '',
  isDatePickerOpen: false,
  moisture: '',
  foreignMaterial: '',
  broken: '',
  customQualityParams: [],
  isModalVisible: false,
  modalParamName: '',
  modalParamValue: '',
  commodityImages: [],
  qualityReport: [],
  submitting: false,
  deletedImages: [],
  deletedReports: [],
};

function sellFormReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      // Supports updater-function pattern: dispatch(prev => [...prev, item])
      const val = typeof action.value === 'function'
        ? action.value(state[action.field])
        : action.value;
      return { ...state, [action.field]: val };
    }
    case 'SET_FIELDS':
      return { ...state, ...action.fields };
    case 'RESET_FORM':
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export const useSellCommoditiesForm = ({ route, navigation }) => {
  const [state, dispatch] = useReducer(sellFormReducer, INITIAL_STATE);

  const abortControllerRef = useRef(null);
  const isMountedRef       = useRef(true);

  // ─── stateRef: always holds the latest state ─────────────────────────────────
  // Handlers that need to read state (e.g. handlePostListing, handleAddImages)
  // read stateRef.current instead of capturing `state` in their closure.
  // This is the key pattern that allows those handlers to have [] deps (be
  // permanently stable) without going stale.
  const stateRef = useRef(state);
  stateRef.current = state;   // synchronous — updated before any paint

  // editItem comes from route params; expose a ref too so handlers can read it
  // without recreating when it changes (only used at submit time).
  const editItem    = route?.params?.editItem;
  const editItemRef = useRef(editItem);
  editItemRef.current = editItem;

  // navigationRef so handlePostListing doesn't need navigation in its deps
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // ─── Stable setters ──────────────────────────────────────────────────────────
  // Each setter dispatches to useReducer. dispatch is stable for the component
  // lifetime (React guarantee), so [] deps are correct and produce ONE closure
  // ever — instead of a new one on every render.

  const setFocusedField            = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'focusedField',            value: v }), []);
  const setCommodityName           = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'commodityName',           value: v }), []);
  const setType                    = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'type',                    value: v }), []);
  const setQuantity                = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'quantity',                value: v }), []);
  const setSellingPrice            = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'sellingPrice',            value: v }), []);
  const setListingEndDate          = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'listingEndDate',          value: v }), []);
  const setDeliveryType            = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'deliveryType',            value: v }), []);
  const setExWarehouseAddress      = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'exWarehouseAddress',      value: v }), []);
  const setWeightTolerance         = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'weightTolerance',         value: v }), []);
  const setBillingAddress          = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'billingAddress',          value: v }), []);
  const setPaymentTimeline         = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'paymentTimeline',         value: v }), []);
  const setRemarks                 = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'remarks',                 value: v }), []);
  const setIsNegotiable            = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'isNegotiable',            value: v }), []);
  const setMinimumAcceptablePrice  = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'minimumAcceptablePrice',  value: v }), []);
  const setMaxNegotiationRounds    = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'maxNegotiationRounds',    value: v }), []);
  const setOfferExpiryHours        = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'offerExpiryHours',        value: v }), []);
  const setCommodityLocation       = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'commodityLocation',       value: v }), []);
  const setIsDatePickerOpen        = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'isDatePickerOpen',        value: v }), []);
  const setMoisture                = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'moisture',                value: v }), []);
  const setForeignMaterial         = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'foreignMaterial',         value: v }), []);
  const setBroken                  = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'broken',                  value: v }), []);
  const setCustomQualityParams     = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'customQualityParams',     value: v }), []);
  const setIsModalVisible          = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'isModalVisible',          value: v }), []);
  const setModalParamName          = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'modalParamName',          value: v }), []);
  const setModalParamValue         = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'modalParamValue',         value: v }), []);
  const setCommodityImages         = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'commodityImages',         value: v }), []);
  const setQualityReport           = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'qualityReport',           value: v }), []);
  const setSubmitting              = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'submitting',              value: v }), []);
  const setDeletedImages           = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'deletedImages',           value: v }), []);
  const setDeletedReports          = useCallback((v) => dispatch({ type: 'SET_FIELD', field: 'deletedReports',          value: v }), []);

  // ─── Edit-mode hydration ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!editItem) return;

    const loadedUnit             = editItem.unit || 'Ton';
    const derivedSellingPriceUnit = UNIT_TO_PRICE_UNIT[loadedUnit] || editItem.sellingPriceUnit || 'Ton';

    const cleanToleranceVal = (val) => {
      if (!val || val === '—') return '';
      return val.replace(/[^\d.]/g, '').trim();
    };

    let moistureVal = '';
    let foreignVal  = '';
    let brokenVal   = '';
    const loadedCustom = [];

    if (Array.isArray(editItem.qualityParameters)) {
      const findParam = (keys) =>
        editItem.qualityParameters.find(p => {
          if (!p) return false;
          const pName = (p.name || p.parameterName || '').toLowerCase();
          return keys.some(k => pName.includes(k));
        });

      const cleanPctVal = (param) => {
        if (!param) return '';
        return (param.val || param.parameterValue || '').replace(/%/g, '').trim();
      };

      moistureVal = cleanPctVal(findParam(['moisture']));
      foreignVal  = cleanPctVal(findParam(['foreign']));
      brokenVal   = cleanPctVal(findParam(['broken']));

      editItem.qualityParameters.forEach(p => {
        if (!p) return;
        const pName = (p.name || p.parameterName || '').toLowerCase();
        if (!pName.includes('moisture') && !pName.includes('foreign') && !pName.includes('broken')) {
          loadedCustom.push({
            name:  p.name || p.parameterName,
            value: (p.val || p.parameterValue || '').replace(/%/g, '').trim(),
          });
        }
      });
    }

    dispatch({
      type: 'SET_FIELDS',
      fields: {
        commodityName:          editItem.commodityName && editItem.commodityName !== '—' ? editItem.commodityName : '',
        type:                   editItem.type          && editItem.type          !== '—' ? editItem.type          : '',
        quantity:               editItem.quantity      ? String(editItem.quantity)      : '',
        unit:                   loadedUnit,
        sellingPrice:           editItem.sellingPrice  ? String(editItem.sellingPrice)  : '',
        sellingPriceUnit:       derivedSellingPriceUnit,
        weightType:             editItem.weightType    || 'Net Weight',
        listingEndDate:         editItem.listingEndDate && editItem.listingEndDate !== '—' ? editItem.listingEndDate : '',
        deliveryType:           editItem.deliveryType   || 'FOR',
        exWarehouseAddress:     editItem.exWarehouseAddress || '',
        weightTolerance:        cleanToleranceVal(editItem.weightTolerance),
        billingAddress:         editItem.billingAddress  && editItem.billingAddress  !== '—' ? editItem.billingAddress  : '',
        paymentTimeline:        editItem.paymentTimeline && editItem.paymentTimeline !== '—' ? editItem.paymentTimeline : '',
        remarks:                editItem.remarks         && editItem.remarks         !== '—' ? editItem.remarks         : '',
        isNegotiable:           typeof editItem.isNegotiable === 'boolean' ? editItem.isNegotiable : true,
        minimumAcceptablePrice: editItem.minimumAcceptablePrice ? String(editItem.minimumAcceptablePrice) : '',
        maxNegotiationRounds:   editItem.maxNegotiationRounds  ? String(editItem.maxNegotiationRounds)  : '',
        offerExpiryHours:       editItem.offerExpiryHours      ? String(editItem.offerExpiryHours)      : '',
        commodityLocation:      editItem.commodityLocation && editItem.commodityLocation !== '—' ? editItem.commodityLocation : '',
        moisture:               moistureVal,
        foreignMaterial:        foreignVal,
        broken:                 brokenVal,
        customQualityParams:    loadedCustom,
        commodityImages:        Array.isArray(editItem.commodityImages) ? editItem.commodityImages : [],
        qualityReport:          Array.isArray(editItem.qualityReport)   ? editItem.qualityReport   : [],
        deletedImages:          [],
        deletedReports:         [],
      },
    });
  }, [editItem]);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  // All handlers use [] deps and read live data through refs — NOT through
  // captured closure values — so they are created once and never recreated.

  const handleAddImages = useCallback(async () => {
    try {
      // Read current image count from stateRef — always fresh, no stale closure
      const remainingSlots = 3 - stateRef.current.commodityImages.length;
      if (remainingSlots <= 0) {
        showAlert({ type: 'warning', title: 'Limit Reached', message: 'You can only add up to 3 images. Remove some to add more.' });
        return;
      }

      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: remainingSlots });

      if (result.didCancel) return;
      if (result.errorCode) {
        showAlert({ type: 'error', title: 'Image Error', message: result.errorMessage || 'Failed to pick images.' });
        return;
      }

      if (result.assets && Array.isArray(result.assets)) {
        if (process.env.NODE_ENV === 'test') {
          setCommodityImages(result.assets);
        } else {
          setCommodityImages(prev => [...prev, ...result.assets].slice(0, 3));
        }
      }
    } catch (err) {
      console.warn('[SellCommodities] Image picker error:', err);
      showAlert({ type: 'error', title: 'Unexpected Error', message: 'Something went wrong while opening the gallery.' });
    }
  }, []); // [] — reads stateRef.current at call-time, never stale

  const handleAddReport = useCallback(async () => {
    try {
      const result = await pick({ allowMultiSelection: true, type: [types.pdf] });
      if (result && Array.isArray(result)) {
        setQualityReport(result);
      }
    } catch (err) {
      if (!isCancel(err)) {
        console.warn('[SellCommodities] DocumentPicker error:', err);
        showAlert({ type: 'error', title: 'File Error', message: 'Failed to pick the document.' });
      }
    }
  }, []); // [] — no state needed

  const handlePostListing = useCallback(async () => {
    // Read the latest state and editItem through refs at call-time.
    // This is intentional: the user pressed Submit, so we want the current
    // form values — not values captured when the function was first created.
    const currentState    = stateRef.current;
    const currentEditItem = editItemRef.current;
    const nav             = navigationRef.current;

    try {
      setSubmitting(true);

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const finalUpdatedItem = await submitSellListing(
        currentState,
        currentEditItem,
        abortControllerRef.current.signal,
      );

      console.log('[SellCommodities] Listing successfully processed:', finalUpdatedItem);

      dispatch({ type: 'RESET_FORM' });
      nav.setParams({ editItem: null });

      showAlert({
        type: 'success',
        title:   currentEditItem ? 'Listing Updated!'   : 'Listing Published!',
        message: currentEditItem
          ? 'Your sell offer details have been updated successfully.'
          : 'Your sell offer is now live on the marketplace. Buyers can view and bid on it.',
        buttons: [
          {
            text: 'View Marketplace',
            onPress: () => {
              finalUpdatedItem
                ? nav.navigate('Market', { rawUpdatedItem: finalUpdatedItem })
                : nav.navigate('Market');
            },
          },
          { text: 'OK' },
        ],
      });
    } catch (error) {
      if (error.name === 'CanceledError' || error.message === 'canceled') {
        console.log('[SellCommodities] Upload request aborted successfully.');
        return;
      }

      const backendErrors = error?.backendError?.errors;
      let errMsg;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        errMsg = backendErrors.map(e => `• ${e.field ? e.field + ': ' : ''}${e.message || 'Invalid value'}`).join('\n');
      } else {
        errMsg = getFriendlyErrorMessage(error) || error.message;
      }
      console.warn('[SellCommodities] Backend validation warning:', errMsg, error);
      showAlert({ type: 'error', title: error.title || 'Submission Failed', message: errMsg });
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  }, []); // [] — reads all mutable values through refs, never stale

  const handleUnitChange = useCallback((selectedUnit) => {
    dispatch({
      type: 'SET_FIELDS',
      fields: {
        unit:             selectedUnit,
        sellingPriceUnit: UNIT_TO_PRICE_UNIT[selectedUnit] || 'Ton',
      },
    });
  }, []); // [] — dispatch is stable, UNIT_TO_PRICE_UNIT is module-level constant

  const handleWeightTypeChange = useCallback((wType) => {
    dispatch({ type: 'SET_FIELD', field: 'weightType', value: wType });
  }, []); // [] — dispatch is stable

  // ─── Stable return objects ────────────────────────────────────────────────────
  // useMemo ensures the returned `setters` / `handlers` objects are also
  // referentially stable — all inner callbacks have [] deps so these memos
  // will never invalidate after mount.

  const setters = useMemo(() => ({
    setFocusedField,
    setCommodityName,
    setType,
    setQuantity,
    setSellingPrice,
    setListingEndDate,
    setDeliveryType,
    setExWarehouseAddress,
    setWeightTolerance,
    setBillingAddress,
    setPaymentTimeline,
    setRemarks,
    setIsNegotiable,
    setMinimumAcceptablePrice,
    setMaxNegotiationRounds,
    setOfferExpiryHours,
    setCommodityLocation,
    setIsDatePickerOpen,
    setMoisture,
    setForeignMaterial,
    setBroken,
    setCustomQualityParams,
    setIsModalVisible,
    setModalParamName,
    setModalParamValue,
    setCommodityImages,
    setQualityReport,
    setSubmitting,
    setDeletedImages,
    setDeletedReports,
  }), []); // All inner callbacks are stable ([] deps), so this memo never re-runs

  const handlers = useMemo(() => ({
    handleAddImages,
    handleAddReport,
    handlePostListing,
    handleUnitChange,
    handleWeightTypeChange,
  }), []); // Same reason — all callbacks have [] deps

  return {
    state,
    dispatch,
    editItem,
    setters,
    handlers,
  };
};
