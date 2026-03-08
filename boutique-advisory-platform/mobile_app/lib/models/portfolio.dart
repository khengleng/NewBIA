class PortfolioSummary {
  final double totalAum;
  final int activePositions;
  final double realizedRoi;
  final double totalPerformance;
  final String kycStatus;
  final String? role;

  PortfolioSummary({
    required this.totalAum,
    required this.activePositions,
    required this.realizedRoi,
    required this.totalPerformance,
    required this.kycStatus,
    this.role,
  });

  factory PortfolioSummary.fromJson(Map<String, dynamic> json) {
    return PortfolioSummary(
      totalAum: (json['totalAum'] as num).toDouble(),
      activePositions: (json['activePositions'] as num).toInt(),
      realizedRoi: (json['realizedRoi'] as num).toDouble(),
      totalPerformance: (json['totalPerformance'] as num).toDouble(),
      kycStatus: json['kycStatus'] as String? ?? 'PENDING',
      role: json['role'] as String?,
    );
  }
}

class PortfolioItem {
  final String id;
  final String name;
  final String sector;
  final double value;
  final double allocation;
  final double returns;
  final String type;

  PortfolioItem({
    required this.id,
    required this.name,
    required this.sector,
    required this.value,
    required this.allocation,
    required this.returns,
    required this.type,
  });

  factory PortfolioItem.fromJson(Map<String, dynamic> json) {
    return PortfolioItem(
      id: json['id'] as String,
      name: json['name'] as String,
      sector: json['sector'] as String,
      value: (json['value'] as num).toDouble(),
      allocation: (json['allocation'] as num).toDouble(),
      returns: (json['returns'] as num).toDouble(),
      type: json['type'] as String,
    );
  }
}
