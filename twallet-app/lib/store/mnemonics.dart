import 'package:bip39/bip39.dart' as bip39;
import 'package:get/get.dart';
import 'package:mobx/mobx.dart';
import 'package:tuple/tuple.dart';
import 'package:tw_wallet_ui/common/secure_storage.dart';
import 'package:tw_wallet_ui/models/identity/account_info.dart';
import 'package:tw_wallet_ui/service/blockchain.dart';
import 'package:tw_wallet_ui/store/account_store.dart';
import 'package:web3dart/web3dart.dart';

part 'mnemonics.g.dart';

typedef GenerateKeysCallback<T> = Future<T> Function(
  int index,
  Tuple2<String, String> keypair,
);

const saveSplitTag = '|';
const identityStartIndex = 1;

class MnemonicsStore extends MnemonicsBase
    with _$MnemonicsStore
    implements AccountStore {
  late Tuple2<String, String> indexZeroKeypair;

  MnemonicsStore(Tuple2<int, String> value) : super(value) {
    generateIndexZeroKeys(value.item2);
  }

  String get firstPublicKey => indexZeroKeypair.item1;

  String get firstPrivateKey => indexZeroKeypair.item2;

  void generateIndexZeroKeys(String mnemonics) {
    indexZeroKeypair = BlockChainService.keypairFromMnenomics(mnemonics);
  }

  Tuple3<int, String, String> peekKeys() {
    final int nextIndex = index + 1;
    final keyPair = BlockChainService.keypairFromMnenomics(
      mnemonics,
      nextIndex,
    );
    return Tuple3(nextIndex, keyPair.item1, keyPair.item2);
  }

  Tuple2<String, String> indexKeys(int index) {
    return BlockChainService.keypairFromMnenomics(
      mnemonics,
      index,
    );
  }

  Future<T> generateKeypair<T>(
    GenerateKeysCallback<T> callBack,
  ) async {
    return Future.value(
      BlockChainService.keypairFromMnenomics(
        mnemonics,
        ++index,
      ),
    ).then((keypair) => callBack(index, keypair)).then((res) {
      return save(newIndex: index).then((_) => res);
    });
  }

  void brandNew({String? mnemonics}) {
    //the index 0 is used to call save identities contract
    value = Tuple2(identityStartIndex, mnemonics ?? bip39.generateMnemonic());
    generateIndexZeroKeys(value.item2);
  }

  static Future<MnemonicsStore> init() async {
    Tuple2<int, String> value;
    final SecureStorage secureStorage = Get.find();
    final String? saved = await secureStorage.get(SecureStorageItem.mnemonics);

    if (null != saved) {
      final List<String> splits = saved.split(saveSplitTag);
      //兼容老版本
      if (splits.length == 1) {
        value = Tuple2(identityStartIndex, saved);
      } else {
        value = Tuple2(int.parse(splits.first), splits.last);
      }
    } else {
      value = Tuple2(identityStartIndex, bip39.generateMnemonic());
    }

    return MnemonicsStore(value);
  }

  @override
  Future<AccountInfo> get accountInfo {
    return generateKeypair(
      (index, keypair) => Future.value(
        AccountInfo(
          (accountInfo) => accountInfo
            ..index = index
            ..address = BlockChainService.publicKeyToAddress(keypair.item1)
            ..pubKey = keypair.item1
            ..priKey = keypair.item2,
        ),
      ),
    );
  }

  @override
  Credentials get credentials => EthPrivateKey.fromHex(firstPrivateKey);
}

abstract class MnemonicsBase with Store {
  MnemonicsBase(this.value);

  @observable
  Tuple2<int, String> value;

  @computed
  int get index => value.item1;

  set index(int newIndex) => value = value.withItem1(newIndex);

  @computed
  String get mnemonics => value.item2;

  @action
  Future<void> save({int newIndex = 0}) async {
    value = Tuple2(newIndex, value.item2);

    final SecureStorage secureStorage = Get.find();
    await secureStorage.set(
      SecureStorageItem.mnemonics,
      '$index$saveSplitTag$mnemonics',
    );
  }
}
