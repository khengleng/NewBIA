class Sme {
  final String id;
  final String name;
  final String sector;
  final String stage;
  final double fundingRequired;
  final String status;
  final String? website;
  final String? location;
  final String? description;

  Sme({
    required this.id,
    required this.name,
    required this.sector,
    required this.stage,
    required this.fundingRequired,
    required this.status,
    this.website,
    this.location,
    this.description,
  });

  factory Sme.fromJson(Map<String, dynamic> json) {
    return Sme(
      id: json['id'] as String,
      name: json['name'] as String,
      sector: json['sector'] as String,
      stage: json['stage'] as String,
      fundingRequired: (json['fundingRequired'] as num).toDouble(),
      status: json['status'] as String,
      website: json['website'] as String?,
      location: json['location'] as String?,
      description: json['description'] as String?,
    );
  }
}
