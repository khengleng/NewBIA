class DAppInfo {
  final String id;
  final String name;
  final String url;
  final String iconAsset;

  DAppInfo(this.id, this.name, this.url, this.iconAsset);
}

List<DAppInfo> dappList = [
  DAppInfo(
    'cambobia-core',
    'Cambobia Platform',
    'https://www.cambobia.com',
    'assets/icons/dapp/loyalty-club.svg',
  ),
  DAppInfo(
    'cambobia-trade',
    'Cambobia Trading',
    'https://trade.cambobia.com',
    'assets/icons/dapp/loyalty-enterprise.svg',
  ),
  DAppInfo(
    'cambobia-support',
    'Cambobia Support',
    'https://www.cambobia.com/settings',
    'assets/icons/dapp/nft.svg',
  ),
];
