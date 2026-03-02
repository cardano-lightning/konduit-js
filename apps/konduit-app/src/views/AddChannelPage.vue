<script lang="ts">
import * as cborCodecs from "@konduit/codec/cbor/codecs/sync";
import { err, ok, Result } from "neverthrow";
import { stringifyAsyncThrowable, wrapAsyncThrowable } from "@konduit/codec/neverthrow";
import type { HttpEndpointError } from "@konduit/konduit-consumer/http";


// FIXME: Wrap CIP-30 errors in a safe manner here
// For now we live with this rather primitve wrapper
export type BrowserWalletError = { type: "BrowserWalletError", error: unknown };

export type BrowserWalletApi = {
  // We are only interested in those three:
  getNetworkId: () => Promise<Result<number, unknown>>;
  getUtxos: () => Promise<Result<string[] | null, unknown>>;
  signTx: (txCborHex: string, partialSign: boolean) => Promise<Result<string, unknown>>;
  getBalance: () => Promise<Result<Value, JsonError | BrowserWalletError>>;
  getChangeAddress: () => Promise<Result<string, unknown>>;
  // getRewardAddresses: () => Promise<string[]>;
  // getUsedAddresses: () => Promise<string[]>;
  submitTx: (txCborHex: string) => Promise<Result<string, unknown>>;
}

const unknown2StringCodec: Codec<unknown, string, string> = {
  deserialise: (input: unknown): Result<string, string> => {
    if(typeof input === "string") {
      return ok(input);
    }
    return err(`Expected a string but got ${typeof input}`);
  },
  serialise: (input: string): string => input,
};

const uknown2ValueCodec: Codec<unknown, Value, JsonError> = codec.pipe(
  codec.pipe(
    unknown2StringCodec,
    cborCodecs.string2CborCodec,
  ),
  Value.cborCodec,
);

// FIXME: walletObject to a `unknown` and live with that :-P
// FIXME: Improve the safety here - every method should return `any` and be
// really validate afterwards.
export const wrapWalletApi = (walletObject: any): BrowserWalletApi => {

  return {
    getNetworkId: () =>
      stringifyAsyncThrowable(() => walletObject.getNetworkId()),
    getUtxos: () => {
      stringifyAsyncThrowable(() => walletObject.getUtxos())
    },
    signTx: (txCborHex: string, partialSign: boolean) =>
      stringifyAsyncThrowable(() => walletObject.signTx(txCborHex, partialSign)),
    getBalance: async () => {
      const possibleBalanceHex = await stringifyAsyncThrowable(() => walletObject.getBalance());
      return possibleBalanceHex.andThen((balance: unknown) => {
        return uknown2ValueCodec.deserialise(balance);
      });
    },
    getChangeAddress: () =>
      stringifyAsyncThrowable(() => walletObject.getChangeAddress()),
    submitTx: (txCborHex: string) =>
      stringifyAsyncThrowable(() => walletObject.submitTx(txCborHex)),
  };
};

const supportedWalletsWithNames = {
  "eternl": "Eternl",
  "gerowallet": "GeroWallet",
  "lace": "Lace",
  "nami": "Nami",
  "typhoncip30": "Typhon",
  "yoroi": "Yoroi",
};

const supportedWallets = Object.keys(supportedWalletsWithNames);

// Just a stub but useful for testing;
const networkId = 1;

// TODO:
// export type NetworkChecker = {
//   anyUtxoExists: (head: string, rest: string[]) => Promise<Result<boolean, HttpEndpointError>>;
//   network: Network;
// };
// 
// FIXME!!!
const utxoExists = async (_utxo: string): Promise<Result<boolean, HttpEndpointError>> => {
  // Let's toss a coin and decide for now:
  return ok(true);
};

const anyUtxoExists = async (head: string, rest: string[]): Promise<Result<boolean, HttpEndpointError>> => {
  for(const utxo of [head, ...rest]) {
    const result = await utxoExists(utxo);
    if(result.isErr()) return err(result.error);
    if(result.value) return ok(true);
  }
  return ok(false);
};

export type WalletNetworkMatchingError =
  | { type: "WalletError", walletErrors: unknown[] }
  | { type: "HttpError", httpError: HttpEndpointError };

const hasMatchingNetwork = async (walletApi: BrowserWalletApi): Promise<Result<boolean, WalletNetworkMatchingError>> => {
  // This only gives us comparsion testnet vs mainnet
  const possibleNetworkId = await walletApi.getNetworkId();
  const possibleUtxos = await walletApi.getUtxos();
  return Result.combine([possibleUtxos, possibleNetworkId]).match(
    async ([utxos, walletNetworkId]) => {
      if(networkId !== walletNetworkId) {
        return ok(false);
      }
      if(utxos === null || utxos.length === 0) {
        return ok(true);
      }
      return (await anyUtxoExists(utxos[0]!, utxos.slice(1))).mapErr((httpError => ({ type: "HttpError", httpError })));
    },
    async (walletErrors) => err({ type: "WalletError", walletErrors })
  );
};

export type BrowserWalletExtension = {
  enable: () => Promise<Result<BrowserWalletApi, unknown>>;
  isEnabled: () => Promise<Result<boolean, unknown>>;
  apiVersion: string;
  key: string;
  name: string;
  icon: string;
}

export const wrapBrowserWalletExtension = (walletExtensionObject: any, walletKey: string): Result<BrowserWalletExtension, string> => {
  if(
    typeof walletExtensionObject.enable === "function"
    && typeof walletExtensionObject.isEnabled === "function"
    && typeof walletExtensionObject.apiVersion === "string"
    && typeof walletExtensionObject.name === "string"
    && typeof walletExtensionObject.icon === "string"
  ) {
    return ok({
      enable: async () => {
        console.log("Calling enable");
        const possibleRawApi = await wrapAsyncThrowable(() => walletExtensionObject.enable());
        return possibleRawApi.map((rawApi) => {
          return wrapWalletApi(rawApi);
        });
      },
      isEnabled: () => wrapAsyncThrowable(() => walletExtensionObject.isEnabled()),
      apiVersion: walletExtensionObject.apiVersion,
      key: walletKey,
      name: supportedWalletsWithNames[walletKey as keyof typeof supportedWalletsWithNames] || walletExtensionObject.name,
      icon: walletExtensionObject.icon,
    } as BrowserWalletExtension);
  } else {
    return err("The provided object does not conform to the expected browser wallet extension interface.") as Result<BrowserWalletExtension, string>;
  }
};

export type WalletInfo = BrowserWalletExtension & {
  api: BrowserWalletApi;
  matchingNetwork: boolean;
};

export type WalletInfoInitError = WalletNetworkMatchingError

export namespace WalletInfo {
  export const init = async (
    extension: BrowserWalletExtension,
  ): Promise<Result<WalletInfo, WalletInfoInitError>> => {
    console.log("Calling init");
    const possibleWalletApi = await extension.enable();
    return possibleWalletApi.match(
      async (api: BrowserWalletApi) => {
        const matchingNetwork: Result<boolean, WalletNetworkMatchingError> = await hasMatchingNetwork(api);
        return (matchingNetwork).map((matchingNetwork) => {
          return {
            api,
            matchingNetwork,
            ...extension,
          } as WalletInfo;
        });
      },
      async () => err({
        type: "WalletError",
        walletErrors: []
      })
    );
  }
}
</script>

<script setup lang="ts">
import MainContainer from "../components/MainContainer.vue";
import { konduitConsumer } from "../store";
import { type Props as ButtonProps } from "../components/Button.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import { useRegle, type Maybe, createRule, type RegleRuleDefinition } from "@regle/core";
import * as rules from '@regle/rules';
import { computed, onMounted, ref, type ComputedRef, type Ref } from "vue";
import { FieldWidth } from "../components/Form/core";
import * as TextField from "../components/Form/TextField.vue";
import * as SelectField from "../components/Form/SelectField.vue";
import * as RadioField from "../components/Form/RadioField.vue";
import { Days, Hours, Milliseconds, NormalisedDuration } from "@konduit/konduit-consumer/time/duration";
import { useDefaultFormatters } from "../composables/l10n";
import { useRouter } from "vue-router";
import { AdaptorFullInfo } from "@konduit/konduit-consumer/adaptorClient";
import * as codec from "@konduit/codec";
import { string2IntCodec, type StringDeserialiser } from "@konduit/codec/urlquery/codecs/sync";
import { stringify } from "@konduit/codec/json";
import { useNotifications } from "../composables/notifications";
import { pipeDeserialisers, type Codec, type Deserialiser } from "@konduit/codec";
import type { JsonError } from "@konduit/codec/json/codecs";
import { Ada, int2AdaCodec, Lovelace, Value } from "@konduit/konduit-consumer/cardano";
import { isEmpty } from "@regle/rules";
import { walletBalanceInfo} from "../store";

const formatError = (error: JsonError): string => {
  if(typeof error === "string") {
    return error;
  }
  return stringify(error);
};

const ruleFromDeserialiser = <T>(
  deserialiser: Deserialiser<string, T, JsonError>,
  handleResult: (result: Result<T, JsonError>) => void = () => {},
): RegleRuleDefinition<string, [], true, { $valid: boolean, deserialisationError: JsonError | null, value: T | null }> => {
  return createRule({
    validator: async (value: Maybe<string>) => {
      if(isEmpty(value)) {
        return { $valid: false, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = deserialiser(value);
      handleResult(deserialisationResult);
      return deserialisationResult.match(
        (value) => {
          return { $valid: true, value, deserialisationError: null }
        },
        (_err) => ({ $valid: false, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}

const ruleFromAsyncDeserialiser = <T>(
  deserialiser: (value: string) => Promise<Result<T, JsonError>>,
  handleResult: (result: Result<T, JsonError>) => Promise<void> = () => Promise.resolve()
): RegleRuleDefinition<string, [], true, { rawValue: Maybe<string>, $valid: boolean, deserialisationError: JsonError | null, value: T | null }> => {
  return createRule({
    validator: async (rawValue: Maybe<string>) => {
      if(isEmpty(rawValue)) {
        return { $valid: false, rawValue, value: null, deserialisationError: "Value is required." };
      }
      let deserialisationResult = await deserialiser(rawValue);
      await handleResult(deserialisationResult);
      return deserialisationResult.match(
        async (value) => {
          return { $valid: true, rawValue, value, deserialisationError: null };
        },
        async (_err) => ({ $valid: false, rawValue, value: null, deserialisationError: _err })
      );
    },
    message: (result) => {
      if(result.deserialisationError) {
        return formatError(result.deserialisationError);
      }
      return "The provided value is not valid.";
    },
  });
}


// Wallet validation is not performed egearly as it requires
// connecting the wallet (so prompting the user).
// When we validate we move the extension from the one list to the other.
const walletBrowserExtensions: Ref<BrowserWalletExtension[]> = ref([]);

const initializeBrowserWallets = async (cardanoObject: any) => {
  const allWalletEntries = Object.entries(cardanoObject) as [string, any][];
  const supportedWalletEntries: [string, BrowserWalletExtension][] = allWalletEntries.map(([key, walletExtensionObject]) => {
    if( supportedWallets.includes(key as any)) {
      const wrappedExtensionResult = wrapBrowserWalletExtension(walletExtensionObject, key);
      if(wrappedExtensionResult.isOk()) {
        return [key, wrappedExtensionResult.value] as [string, BrowserWalletExtension];
      }
    }
    return null;
  }).filter((entry): entry is [string, BrowserWalletExtension] => entry !== null) as [string, BrowserWalletExtension][];
  console.log("Initialized browser wallets", supportedWalletEntries.map(([key, _extension]) => key));
  walletBrowserExtensions.value = supportedWalletEntries.map(([_key, extension]) => extension);
};

console.log("setup section runs");

onMounted(() => {
  console.log("*** onMounted started ***");  // Use console.log, not debug, to match your working setup log
  console.log("cardano present?", "cardano" in globalThis);
  if ("cardano" in globalThis) {
    console.log("*** Calling initializeBrowserWallets ***");
    initializeBrowserWallets((globalThis as any).cardano);
  } else {
    console.log("*** NO CARDANO ***");
  }
});

const walletTypeSelectionFields = computed(() => {
  // Three options: embedded wallet, external wallet, browser wallet.
  const walletBrowserExtensionsAvailable = walletBrowserExtensions.value.length > 0;
  const options = [
    { value: "embedded", label: "Embedded Wallet"},
    { value: "external", label: "External Wallet"},
    { value: "browser", label: "Browser Wallet", disabled: !walletBrowserExtensionsAvailable },
  ];

  return {
    walletType: {
      fieldWidth: FieldWidth.full,
      isValid: true,
      // isValid(
      //   r$.amount.$dirty,
      //   r$.respondPeriod.$rules.respondPeriod.$valid
      // ),
      label: "Funding wallet type",
      type: SelectField.select,
      options,
      errors: walletTypeForm.r$.walletType.$errors,
    }
  }
});

//if (r$.$ready && !walletTypeSelectionSubmitting.value) {
const browserWalletSelectionSubmitting = ref(false);

const handleBrowserWalletSelectionSubmit = async () => {
  if(browserWalletSelectionSubmitting.value) {
    return;
  }
  browserWalletSelectionSubmitting.value = true;
  const isValid = await browserWalletSelectionForm.r$.$validate();
  browserWalletSelectionSubmitting.value = false;
  const walletInfo = browserWalletSelectionForm.r$.browserWallet.$rules.walletInfo.$metadata.value;

  if (isValid && walletInfo != null) {
    console.log(await walletInfo.api.getBalance());
    const possibleBalanceValue = await walletInfo.api.getBalance();
    console.log("Balance value", possibleBalanceValue);
  }
}

const walletInfoRule = ruleFromAsyncDeserialiser(
  async (walletKey: string): Promise<Result<WalletInfo, string>> => {
    const extension = walletBrowserExtensions.value.find(wallet => wallet.key === walletKey) as BrowserWalletExtension;
    if(!extension) {
      return err("Selected wallet is not available.");
    }
    const possibleWalletInfo = await WalletInfo.init(extension);
    return possibleWalletInfo.match(
      (walletInfo) => {
        if(!walletInfo.matchingNetwork) {
          return err("The selected wallet is connected to a different network than the one configured in the app. Please switch your wallet's network and try again.");
        }
        return ok(walletInfo);
      },
      (error) => {
        switch(error.type) {
          case "WalletError":
            return err(`An error occurred while connecting to the wallet... `);
          case "HttpError":
            return err(`An networking problem occurred while trying to verify the wallet's network`);
        }
      }
    );
  },
);

const walletBrowserExtensionsChoices = computed(() => {
  return walletBrowserExtensions.value.map(wallet => ({
    value: wallet.key,
    label: wallet.name,
    disabled: false,
    icon: wallet.icon,
  })).sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
});

const browserWalletSelectionFormState = {
  browserWallet: ref<string>(''),
};

const browserWalletSelectionFields = computed(() => {
  return {
    browserWallet: {
      errors: (() => {
        const rawValue = browserWalletSelectionForm.r$.browserWallet.$rules.walletInfo.$metadata.rawValue;
        const messages = browserWalletSelectionForm.r$.browserWallet.$errors;
        if(isEmpty(rawValue)) {
          return messages;
        }
        return {
          messages: browserWalletSelectionForm.r$.browserWallet.$errors,
          value: rawValue
        }
      })(),
      fieldWidth: FieldWidth.full,
      isValid: isValid(
        browserWalletSelectionForm.r$.browserWallet.$dirty,
        browserWalletSelectionForm.r$.browserWallet.$rules.walletInfo.$valid
      ),
      label: "",
      layout: { type: 'inline', maxItemsPerRow: 2 } as RadioField.Layout,
      options: walletBrowserExtensionsChoices.value,
      type: RadioField.radio,
    }
  }
});

const browserWalletSelectionForm = useRegle(browserWalletSelectionFormState, {
  browserWallet: {
    // rule:
    required: rules.required,
    walletInfo: walletInfoRule,
    // $debounce: 500,
  }
}, {
  silent: true,
});

const walletTypeSelectionFormState = {
  walletType: ref<string>('browser'),
};

const walletTypeForm = useRegle(walletTypeSelectionFormState, {
  walletType: {
    required: rules.required,
  }
});

const browserWalletSelectionButtons = computed(() => {
  return [
    {
      label: "Back",
      action: () => { walletTypeSelectionFormState.walletType.value = ''; },
      primary: false,
    },
    {
      disabled: browserWalletSelectionSubmitting.value,
      label: "Connect Wallet",
      action: handleBrowserWalletSelectionSubmit,
      primary: true,
    }
  ];
});


// const { r$ } = useRegle(formState, {
//   adaptorUrl: {
//     required: rules.required,
//     adaptorUrl: adaptorUrlRule,
//     $debounce: 1000,
//   },
//   respondPeriod: {
//     required: rules.required,
//     respondPeriod: respondPeriodRule,
//     $debounce: 500,
//   },
//   amount: {
//     ada: adaRule,
//     $debounce: 500,
//   },
//   currency: {
//     required: rules.required,
//   },
// });

// We want to run the validation immediately so
// r$.adaptorUrl.$touch();


const formatters = useDefaultFormatters();

// We keep this additional value reference to access the validated
// value from the respond period options setup and disable options
// based on the info dynamically provided by the adaptor.
const adaptorFullInfo = ref<AdaptorFullInfo | null>(null);

const adaptorUrlRule = ruleFromAsyncDeserialiser(
  async (value: string): Promise<Result<AdaptorFullInfo, string>> => {
    const result = await AdaptorFullInfo.fromString(value);
    result.map((info) => {
      adaptorFullInfo.value = info;
    });
    return result.mapErr((error) => {
      switch(error.type) {
        case "HttpError":
          return `The provided URL returned an HTTP error: ${error.status} ${error.statusText}`;
        case "NetworkError":
          return `The provided URL is unreachable (due to server setup like CORS or networking problem): "${error.message}"`;
        case "DeserialisationError":
          return `The provided URL did not return a valid Cardano Connector backend response: ${stringify(error.message)}`;
        default:
          return "An unknown error occurred while validating the provided URL.";
      }
    });
  }
);
const walletBalance = computed(() => {
  return walletBalanceInfo.value?.lastValue || Lovelace.zero;
});

const adaRule = ruleFromDeserialiser<Ada>((() => {
  const adaDeserialiser = codec.pipe(
    string2IntCodec,
    int2AdaCodec,
  ).deserialise;
  return pipeDeserialisers(
    adaDeserialiser,
    (ada) => {
      const amountLovelace = Lovelace.fromAda(ada);
      if(Lovelace.ord.isGreaterThan(amountLovelace, walletBalance.value)) {
        const walletBalanceStr = formatters.formatAda(walletBalance.value);
        const amountStr = formatters.formatAda(amountLovelace);
        return err(
          `The provided amount ${amountStr} exceeds your wallet balance ${walletBalanceStr}. Please provide a smaller amount or top up your wallet.`);
      }
      if(ada == 0) {
        return err("You can not open a channel with zero amount. Please provide a positive amount of ADA.");
      }
      return ok(ada);
    }
  );

})());

// This setup reacts to the adaptor changes:
// * we disable respond periods that are shorter than the adaptor's required close period
// * we adjust the selected respond period if it becomes invalid
const respondPeriodFieldSetup = computed(() => {
  const allowedRespondTimes = [
    NormalisedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(6) }),
    NormalisedDuration.fromComponentsNormalization({ hours: Hours.fromDigits(1, 2) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(1) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(2) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(4) }),
    NormalisedDuration.fromComponentsNormalization({ days: Days.fromDigits(7) }),
  ];
  const optionsInfo = allowedRespondTimes.map(nd => {
    let milliseconds = Milliseconds.fromNormalisedDuration(nd);
    let optionValue = `${milliseconds}`;
    let label = formatters.formatDurationLong(nd);
    let disabled = (
        (adaptorFullInfo.value || false)
        && Milliseconds.ord.isGreaterThan(
            Milliseconds.fromSeconds(adaptorFullInfo.value[1].closePeriod),
            milliseconds
          )
      );
    return {
      origValue: nd,
      optionValue,
      label,
      disabled,
    };
  });

  const options = optionsInfo.map(info => ({
    value: info.optionValue,
    label: info.label,
    disabled: info.disabled,
  }));

  const optionValue2DurationInfo = optionsInfo.reduce((acc, info) => {
    acc[info.optionValue] = [info.origValue, info.disabled];
    return acc;
  }, {} as Record<string, [NormalisedDuration, boolean]>);

  return {
    options,
    optionValue2DurationInfo,
  };
});

// We need this ref to pass it to the deserialiser factory below.
const respondPeriodOptionsRef = computed(() => {
  return respondPeriodFieldSetup.value.optionValue2DurationInfo;
});

const respondPeriodRule = (() => {
  const mkString2RespondPeriodDeserialiser = (optionsRef: Ref<Record<string, [NormalisedDuration, boolean]>>): StringDeserialiser<NormalisedDuration> => {
    return (value: string) => {
      if(!optionsRef.value)
        return err("Respond period options are not configured yet.");
      const options = optionsRef.value;
      if(!options[value]) return err(`No such respond period option: ${value}`);
      let [duration, disabled] = options[value];
      if(disabled) {
        return err(`The selected respond period of ${formatters.formatDurationLong(duration)} is not valid for the current adaptor.`);
      }
      return ok(duration);
    }
  };
  return ruleFromDeserialiser(
    mkString2RespondPeriodDeserialiser(respondPeriodOptionsRef)
  );
})();

const formState = (() => {
  const initialRespondPeriodOpt = respondPeriodFieldSetup.value?.options.find(opt => !opt.disabled);
  const initialRespondPeriod: string = initialRespondPeriodOpt ? initialRespondPeriodOpt.value : '';
  return {
    adaptorUrl: ref('https://ada.konduit.channel'),
    respondPeriod: ref(initialRespondPeriod),
    amount: ref(''),
    currency: ref('ADA'),
  };
})();

const { r$ } = useRegle(formState, {
  adaptorUrl: {
    required: rules.required,
    adaptorUrl: adaptorUrlRule,
    $debounce: 1000,
  },
  respondPeriod: {
    required: rules.required,
    respondPeriod: respondPeriodRule,
    $debounce: 500,
  },
  amount: {
    ada: adaRule,
    $debounce: 500,
  },
  currency: {
    required: rules.required,
  },
});

// We want to run the validation immediately so
r$.adaptorUrl.$touch();

const isValid = (dirty: boolean, valid: boolean) => {
  if(!dirty) return null;
  return valid;
};

const isFormFieldName = (name: string): name is ("adaptorUrl" | "respondPeriod" | "amount" | "currency") => {
  return ["adaptorUrl", "respondPeriod", "amount", "currency"].includes(name);
};

const touch = (fieldName: string) => {
  if(isFormFieldName(fieldName)) {
    const field = r$[fieldName];
    if(field && !field.$dirty) {
      field.$touch();
    }
  }
};

const notifications = useNotifications();

const fields = computed(() => {
  return {
    adaptorUrl: {
      fieldWidth: FieldWidth.full,
      isValid: isValid(r$.adaptorUrl.$dirty, r$.adaptorUrl.$rules.adaptorUrl.$valid),
      label: "Adaptor's URL",
      type: TextField.url,
      placeholder: "https://example-adaptor.com",
      errors: r$.adaptorUrl.$errors,
    },
    respondPeriod: (() => {
      return {
        fieldWidth: FieldWidth.full,
        isValid: isValid(
          r$.amount.$dirty,
          r$.respondPeriod.$rules.respondPeriod.$valid
        ),
        label: "Respond Period",
        type: SelectField.select,
        options: respondPeriodFieldSetup.value.options,
        errors: r$.respondPeriod.$errors,
      };
    })(),
    amount: {
      fieldWidth: FieldWidth.half,
      isValid: isValid(
        r$.amount.$dirty,
        r$.amount.$rules.ada.$valid,
      ),
      label: "Amount",
      placeholder: `Maximum ${formatters.formatAda(walletBalance.value)}`,
      type: TextField.number,
      errors: r$.amount.$errors,
    },
    // Placeholder for the future currency choice
    currency: {
      disabled: true,
      errors: r$.currency.$errors,
      fieldWidth: FieldWidth.half,
      isValid: true,
      label: "Currency / Unit",
      options: ["ADA"],
      type: SelectField.select,
    }
  };
});

const walletTypeSelectionSubmitting = ref(false);

const handleSubmit = async () => {
  if (r$.$ready && !walletTypeSelectionSubmitting.value) {
    let ada = r$.amount.$rules.ada.$metadata.value;
    let respondPeriod = r$.respondPeriod.$rules.respondPeriod.$metadata.value;
    let adaptorFullInfo = r$.adaptorUrl.$rules.adaptorUrl.$metadata.value;
    if(konduitConsumer.value == null || ada == null || respondPeriod == null || adaptorFullInfo == null) {
      notifications.error("Criticial - cannot open a channel: app state is inconsistent");
      return;
    }
    walletTypeSelectionSubmitting.value = true;
    const openningResult = await konduitConsumer.value.openChannel(
      adaptorFullInfo,
      Lovelace.fromAda(ada),
      Milliseconds.fromNormalisedDuration(respondPeriod)
    );
    walletTypeSelectionSubmitting.value = false;
    return openningResult.match(
      (_channel) => {
        if(konduitConsumer.value != null) {
          console.error(konduitConsumer.value._channels);
        } else {
          console.error("No channels found.");
        }
        notifications.redirectSuccess("Channel opening transaction was just submitted. It may take some time to confirm it on the blockchain and be accepted and fully trusted by the adaptor.", redirectPage);
      },
      (error) => {
        notifications.error(`Failed to open channel: ${error}. Please try again or contact support if the problem persists.`);
      }
    );
  } else {
    notifications.warn("Please fix the errors in the form before submitting.");
  }
};

const router = useRouter();

const redirectPage = (() => {
  const redirectTo = router.currentRoute.value.query.redirectTo;
  if(typeof redirectTo === "string") {
    return redirectTo;
  } else {
    return { name: 'home' };
  }
})();

const buttons: ComputedRef<ButtonProps[]> = computed(() => {
  return [
    {
      label: "Cancel",
      action: () => { router.push(redirectPage); },
      primary: false,
    },
    {
      disabled: !r$.$ready || walletTypeSelectionSubmitting.value,
      label: "Open",
      action: handleSubmit,
      primary: true,
    },
  ]
});
</script>

<template>
  <MainContainer>
    <TheHeader />
    <div id="forms">
      <Form
        :buttons="[]"
        :fields="walletTypeSelectionFields"
        :formState="walletTypeSelectionFormState"
        :handleSubmit="() => {}"
        :touch="() => {}"
      />
      <Transition name="fade" mode="out-in">
        <Form
          v-if="walletTypeSelectionFormState.walletType.value == 'browser'"
          :buttons="browserWalletSelectionButtons"
          :fields="browserWalletSelectionFields"
          :formState="browserWalletSelectionFormState"
          :handleSubmit="handleBrowserWalletSelectionSubmit"
          :touch="(value) => console.log('Touched browser wallet selection field', value)"
        />
        <div v-else-if="walletTypeSelectionFormState.walletType.value == 'external'">
          <p>External wallet option is not implemented yet. Please select the embedded wallet option for now.</p>
        </div>
         <div v-else-if="walletTypeSelectionFormState.walletType.value == 'embedded'">
          <p>Embedded wallet option is not implemented yet. Please select the browser wallet option for...</p>
        </div>
      </Transition>
      <!--
      <Form :buttons="buttons" :fields="fields" :formState="formState" :handleSubmit="handleSubmit" :touch="touch" />
      -->
    </div>
  </MainContainer>
</template>

<style scoped>
#forms {
  display: flex;
  flex-direction: column;
  gap: 2em;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

