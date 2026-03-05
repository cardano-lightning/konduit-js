<script lang="ts">
import * as cborCodecs from "@konduit/codec/cbor/codecs/sync";
import * as jsonCodecs from "@konduit/codec/json/codecs";
import { err, ok, Result } from "neverthrow";
import { stringifyAsyncThrowable, wrapAsyncThrowable } from "@konduit/codec/neverthrow";
import type { HttpEndpointError } from "@konduit/konduit-consumer/http";
import { ruleFromAsyncDeserialiser } from "../utils/regle";
import { useEmbeddedWalletDetails } from "../composables/walletDetails";
import { wallet } from "../store";
import { useRouter } from "vue-router";
// import { walletBalance } from "src/store";

// FIXME: Wrap CIP-30 errors in a safe manner here
// For now we live with this rather primitve wrapper
export type BrowserWalletError = { type: "BrowserWalletError", error: unknown };

export type BrowserWalletApi = {
  // We are only interested in those three:
  getNetworkId: () => Promise<Result<number, unknown>>;
  getUtxos: () => Promise<Result<TransactionUnspentOutput[] | null, unknown>>;
  signTx: (txCborHex: string, partialSign: boolean) => Promise<Result<string, unknown>>;
  getBalance: () => Promise<Result<Value, JsonError | BrowserWalletError>>;
  getChangeAddress: () => Promise<Result<string, unknown>>;
  // getRewardAddresses: () => Promise<string[]>;
  // getUsedAddresses: () => Promise<string[]>;
  submitTx: (txCborHex: string) => Promise<Result<string, unknown>>;
}

const unknown2JsonCodec = {
  deserialise: (input: unknown): Result<Json, string> => {
    if(isJson(input)) {
      return ok(input);
    }
    return err(`Expected a JSON value but got ${typeof input}`);
  },
  serialise: (input: Json): unknown => input,
};

const uknown2ValueCodec: Codec<unknown, Value, JsonError> =
  codec.pipe(
    unknown2JsonCodec,
    codec.pipe(
      jsonCodecs.json2StringCodec,
      codec.pipe(
        cborCodecs.string2CborCodec,
        Value.cborCodec,
      )
    ),
  );

const unknown2TransactionUnspentOutputCodec: Codec<unknown, TransactionUnspentOutput[], JsonError> =
  codec.pipe(
    unknown2JsonCodec,
    jsonCodecs.arrayOf(
      codec.pipe(
        jsonCodecs.json2StringCodec,
        codec.pipe(
          cborCodecs.string2CborCodec,
          TransactionUnspentOutput.cborCodec,
        ),
      )
    )
  );

// FIXME: walletObject to a `unknown` and live with that :-P
// FIXME: Improve the safety here - every method should return `any` and be
// really validate afterwards.
export const wrapWalletApi = (walletObject: any): BrowserWalletApi => {

  return {
    getNetworkId: () =>
      stringifyAsyncThrowable(() => walletObject.getNetworkId()),
    getUtxos: async () => {
      const something = await stringifyAsyncThrowable(() => walletObject.getUtxos())
      return something.andThen((utxos: unknown) => {
        return unknown2TransactionUnspentOutputCodec.deserialise(utxos);
      });
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
const utxoExists = async (_input: TxInput): Promise<Result<boolean, HttpEndpointError>> => {
  // Let's toss a coin and decide for now:
  return ok(true);
};

const anyUtxoExists = async (head: TxInput, rest: TxInput[]): Promise<Result<boolean, HttpEndpointError>> => {
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
  console.log(possibleUtxos);
  return Result.combine([possibleUtxos, possibleNetworkId]).match(
    async ([utxos, walletNetworkId]) => {
      if(networkId !== walletNetworkId) {
        return ok(false);
      }
      if(utxos === null || utxos.length === 0) {
        return ok(true);
      }
      const utxosJson = jsonCodecs.arrayOf(TransactionUnspentOutput.jsonCodec).serialise(utxos);
      console.log("Utxos json", utxosJson);
      const inputs = utxos.map(utxo => utxo.input);
      return (await anyUtxoExists(inputs[0]!, inputs.slice(1))).mapErr((httpError => ({ type: "HttpError", httpError })))
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
import Hr from "../components/Hr.vue";
import WalletSummary from "../components/WalletSummary.vue";
import Konduit from "../components/icons/Konduit.vue";
import CircleAdaSign from "../components/icons/CircleAdaSign.vue";
import Callout from "../components/Callout.vue";
import WalletBalance from "../components/WalletBalance.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import Form from "../components/Form.vue";
import { useRegle } from "@regle/core";
import * as rules from '@regle/rules';
import { computed, onMounted, ref, type Ref } from "vue";
import { FieldWidth } from "../components/Form/core";
import * as SelectField from "../components/Form/SelectField.vue";
import * as RadioField from "../components/Form/RadioField.vue";
import * as codec from "@konduit/codec";
import { isJson, type Json } from "@konduit/codec/json";
import { type Codec } from "@konduit/codec";
import type { JsonError } from "@konduit/codec/json/codecs";
import { TransactionUnspentOutput, TxInput, Value } from "@konduit/konduit-consumer/cardano";
import { isEmpty } from "@regle/rules";

const { walletBalance } = useEmbeddedWalletDetails(wallet);

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

let startedWithEmptyEmbeddedWallet = false;

onMounted(() => {
  if(walletBalance.value == null || walletBalance.value === 0n) {
    startedWithEmptyEmbeddedWallet = true;
  }

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

  // isValid(
  //   r$.amount.$dirty,
  //   r$.respondPeriod.$rules.respondPeriod.$valid
  // ),
  return {
    walletType: {
      errors: walletTypeForm.r$.walletType.$errors,
      fieldWidth: FieldWidth.full,
      info: () => console.log("Info box"),
      isValid: true,
      label: "Wallet type",
      options,
      type: SelectField.select,
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

const isValid = (dirty: boolean, valid: boolean) => {
  if(!dirty) return null;
  return valid;
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
  walletType: ref<string>('embedded'),
};

const walletTypeForm = useRegle(walletTypeSelectionFormState, {
  walletType: {
    required: rules.required,
  }
});

const embeddedWalletFunded = computed(() => {
  return walletBalance.value != null && walletBalance.value > 0n;
});

const router = useRouter();

const browserWalletSelectionButtons = computed(() => {
  if (walletTypeSelectionFormState.walletType.value === 'browser') {
    return [
      {
        label: "Back",
        action: () => { walletTypeSelectionFormState.walletType.value = ''; },
        primary: false,
      },
      {
        disabled: browserWalletSelectionSubmitting.value && browserWalletSelectionForm.r$.$ready,
        label: "Connect Wallet",
        action: handleBrowserWalletSelectionSubmit,
        primary: true,
      }
    ];
  } else if(walletTypeSelectionFormState.walletType.value === 'external') {
    return [
      {
        label: "Back",
        action: () => { walletTypeSelectionFormState.walletType.value = ''; },
        primary: false,
      },
    ];
  } else if(walletTypeSelectionFormState.walletType.value === 'embedded') {
    return [
      {
        label: "Back",
        action: () => { walletTypeSelectionFormState.walletType.value = ''; },
        primary: false,
      },
      {
        disabled: !embeddedWalletFunded.value,
        label: "Next",
        action: () => router.push({
          name: 'channel-open-with-embedded-wallet',
          query: router.currentRoute.value.query.redirectTo ? { redirectTo: router.currentRoute.value.query.redirectTo } : undefined,
        }),
        primary: true,
      }
    ];
  } else {
    return [
      {
        label: "Back",
        action: () => { walletTypeSelectionFormState.walletType.value = ''; },
        primary: false,
      },
      {
        disabled: true,
        label: "Next",
        action: handleBrowserWalletSelectionSubmit,
        primary: true,
      }
    ];
  }
});

/*
    <DataListing :rows="[
      { label: 'Cardano Network', formattedValue: network },
      { label: 'Address', formattedValue: formattedAddress, actions: addressActions },
    ]" />
*/


</script>

<template>
  <MainContainer :buttons="browserWalletSelectionButtons">
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
          :buttons="[]"
          :fields="browserWalletSelectionFields"
          :formState="browserWalletSelectionFormState"
          :handleSubmit="handleBrowserWalletSelectionSubmit"
          :touch="(value) => console.log('Touched browser wallet selection field', value)"
        />
        <div v-else-if="walletTypeSelectionFormState.walletType.value == 'external'">
          <p>External wallet option is not implemented yet. Please select the embedded wallet option for now.</p>
        </div>
         <div v-else-if="walletTypeSelectionFormState.walletType.value == 'embedded'" id="embedded-wallet-section">
          <WalletBalance />
          <Callout
            :title="'Wallet ready but empty'"
            :variant="'info'"
            v-if="walletBalance == 0n"
          >
            <template #icon>
              <CircleAdaSign />
            </template>
            <div>
            Copy or scan the below address and top up your embedded wallet with ADA to fund your first channel.
            </div>
          </Callout>
          <Callout
            :title="'Wallet ready - open up a channel!'"
            :variant="'success'"
            v-else-if="startedWithEmptyEmbeddedWallet && walletBalance > 0n"
          >
            <template #icon>
              <Konduit />
            </template>
            <div>
            Your embedded wallet is ready to use!<br />You can proceed to open a channel.
            </div>
          </Callout>
          <Hr v-else />
          <WalletSummary />
        </div>

      </Transition>
    </div>
  </MainContainer>
</template>

<style scoped>
#forms {
  display: flex;
  flex-direction: column;
  gap: calc(var(--data-listing-gap) * 2);
}

#embedded-wallet-section {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

