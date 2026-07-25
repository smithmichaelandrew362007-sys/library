import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';

class UpdateInfo {
  final String currentVersion;
  final String latestVersion;
  final String releaseNotes;
  final String apkUrl;
  final String htmlUrl;
  final bool hasUpdate;

  UpdateInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.releaseNotes,
    required this.apkUrl,
    required this.htmlUrl,
    required this.hasUpdate,
  });
}

class UpdateService {
  static const String _repoOwner = 'smithmichaelandrew362007-sys';
  static const String _repoName = 'library';
  static const String _releasesUrl =
      'https://api.github.com/repos/$_repoOwner/$_repoName/releases/latest';

  /// Check GitHub API for the latest release
  static Future<UpdateInfo> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final String currentVerStr = packageInfo.version;

      final response = await http.get(
        Uri.parse(_releasesUrl),
        headers: {'Accept': 'application/vnd.github.v3+json'},
      );

      if (response.statusCode != 200) {
        throw Exception(
            'Failed to fetch latest release (HTTP ${response.statusCode})');
      }

      final Map<String, dynamic> data = json.decode(response.body);
      final String tagName = data['tag_name'] ?? '';
      final String latestVerStr = tagName.replaceAll(RegExp(r'^[vV]'), '').trim();
      final String releaseNotes = data['body'] ?? 'No release notes provided.';
      final String htmlUrl = data['html_url'] ?? '';

      String apkUrl = '';
      final List<dynamic> assets = data['assets'] ?? [];
      for (var asset in assets) {
        final String name = asset['name'] ?? '';
        if (name.endsWith('.apk')) {
          apkUrl = asset['browser_download_url'] ?? '';
          break;
        }
      }

      final bool isNewer = _isVersionNewer(currentVerStr, latestVerStr);

      return UpdateInfo(
        currentVersion: currentVerStr,
        latestVersion: latestVerStr.isEmpty ? currentVerStr : latestVerStr,
        releaseNotes: releaseNotes,
        apkUrl: apkUrl,
        htmlUrl: htmlUrl,
        hasUpdate: isNewer && apkUrl.isNotEmpty,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Error checking for update: $e');
      }
      rethrow;
    }
  }

  /// Simple semver comparison helper (e.g. "1.0.1" > "1.0.0")
  static bool _isVersionNewer(String current, String latest) {
    if (latest.isEmpty) return false;
    try {
      final List<int> currentParts =
          current.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      final List<int> latestParts =
          latest.split('.').map((e) => int.tryParse(e) ?? 0).toList();

      final int maxLen =
          currentParts.length > latestParts.length ? currentParts.length : latestParts.length;

      for (int i = 0; i < maxLen; i++) {
        final int c = i < currentParts.length ? currentParts[i] : 0;
        final int l = i < latestParts.length ? latestParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (_) {
      return latest != current;
    }
    return false;
  }

  /// Open APK download URL in external browser — Android will detect the .apk
  /// and prompt the user to install it (requires "install unknown apps" permission).
  static Future<bool> openApkDownload(String apkUrl) async {
    if (apkUrl.isEmpty) return false;
    final Uri uri = Uri.parse(apkUrl);
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        return true;
      }
      return await launchUrl(uri, mode: LaunchMode.platformDefault);
    } catch (_) {
      try {
        return await launchUrl(uri);
      } catch (_) {
        return false;
      }
    }
  }

  /// Open release page in external browser (fallback)
  static Future<bool> openReleaseWebpage(String url) async {
    if (url.isEmpty) return false;
    final Uri uri = Uri.parse(url);
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        return true;
      }
      return await launchUrl(uri, mode: LaunchMode.platformDefault);
    } catch (_) {
      try {
        return await launchUrl(uri);
      } catch (_) {
        return false;
      }
    }
  }

  /// Download APK directly inside the app with real-time stream progress,
  /// and trigger Android's native installer popup upon completion.
  static Future<String?> downloadAndInstallApk(
    String apkUrl, {
    required Function(double progress, int downloadedBytes, int totalBytes) onProgress,
  }) async {
    if (apkUrl.isEmpty) return 'No APK download URL provided.';
    try {
      final dir = await getExternalStorageDirectory() ?? await getTemporaryDirectory();
      final filePath = '${dir.path}/libravault_update.apk';
      final file = File(filePath);
      if (await file.exists()) {
        await file.delete();
      }

      final client = http.Client();
      final request = http.Request('GET', Uri.parse(apkUrl));
      final response = await client.send(request);

      if (response.statusCode != 200) {
        client.close();
        return 'Server returned HTTP ${response.statusCode} while downloading APK.';
      }

      final int totalBytes = response.contentLength ?? 0;
      int downloadedBytes = 0;
      final sink = file.openWrite();

      await response.stream.map((chunk) {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          onProgress(downloadedBytes / totalBytes, downloadedBytes, totalBytes);
        } else {
          onProgress(0.5, downloadedBytes, totalBytes);
        }
        return chunk;
      }).pipe(sink);

      await sink.close();
      client.close();

      final result = await OpenFilex.open(filePath, type: 'application/vnd.android.package-archive');
      if (result.type != ResultType.done) {
        return 'Failed to open installer: ${result.message}';
      }
      return null; // Success!
    } catch (e) {
      return 'Download error: $e';
    }
  }
}
