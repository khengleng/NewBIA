class SecondaryListing {
  final String id;
  final String dealId;
  final String dealTitle;
  final double pricePerShare;
  final double sharesAvailable;
  final String sellerName;
  final String sector;
  final String status;

  SecondaryListing({
    required this.id,
    required this.dealId,
    required this.dealTitle,
    required this.pricePerShare,
    required this.sharesAvailable,
    required this.sellerName,
    required this.sector,
    required this.status,
  });

  factory SecondaryListing.fromJson(Map<String, dynamic> json) {
    final deal = json['deal'] ?? {};
    final sme = deal['sme'] ?? {};
    
    return SecondaryListing(
      id: json['id'] as String,
      dealId: deal['id'] as String? ?? '',
      dealTitle: deal['title'] as String? ?? 'Private Equity Asset',
      pricePerShare: (json['pricePerShare'] as num).toDouble(),
      sharesAvailable: (json['sharesAvailable'] as num).toDouble(),
      sellerName: json['seller']?['name'] as String? ?? 'Institutional Seller',
      sector: sme['sector'] as String? ?? 'Technology',
      status: json['status'] as String,
    );
  }
}
