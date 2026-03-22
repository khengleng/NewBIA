import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart' as g;
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/common/http/loading_interceptor.dart';
import 'package:tw_wallet_ui/models/api_error.dart';
import 'package:tw_wallet_ui/widgets/hint_dialog.dart';

void showErrorDialog(DioException err) {
  String errorMessage = '未知错误';
  DialogType hintType = DialogType.error;

  if (err.type == DioExceptionType.connectionTimeout ||
      err.type == DioExceptionType.sendTimeout ||
      err.type == DioExceptionType.receiveTimeout) {
    hintType = DialogType.network;
  }

  switch (err.type) {
    case DioExceptionType.connectionTimeout:
      errorMessage = '连接超时';
      break;

    case DioExceptionType.sendTimeout:
      errorMessage = '发送超时';
      break;

    case DioExceptionType.receiveTimeout:
      errorMessage = '接收超时';
      break;

    case DioExceptionType.cancel:
      errorMessage = '用户取消';
      break;

    default:
      final response = err.response;
      if (response != null) {
        if (response.statusCode == 400) {
          final err = ApiError.fromJson(response.data)!;
          if (isUserError(err)) {
            errorMessage = err.message;
          } else {
            errorMessage = '请求失败';
          }
        }
        if (response.statusCode! >= 500) {
          errorMessage = '服务端不响应';
        }
      }
      break;
  }
  showDialogSimple(hintType, '$errorMessage，请稍后再试。。。');
}

// see ErrorCode.java in project tw-wallet-backend/
bool isUserError(ApiError err) => err.code > 40000 && err.code < 50000;

Dio _initDio() {
  final LoadingInterceptor loadingInterceptor = g.Get.find();
  final LogInterceptor logInterceptor = g.Get.find();
  final Dio dio = Dio()
    ..options = BaseOptions(
      baseUrl: Application.globalEnv.apiGatewayBaseUrl,
      connectTimeout: Duration(
        milliseconds: Application.globalEnv.apiGatewayConnectTimeout,
      ),
    )
    ..interceptors.add(loadingInterceptor);

  if (kDebugMode) {
    dio.interceptors.add(logInterceptor);
  }

  return dio;
}

class HttpClient {
  final Dio _dio = _initDio();

  Future<Response> get(
    String url, {
    bool loading = true,
    bool throwError = false,
  }) async {
    return _dio
        .get(url, options: Options(extra: {'withoutLoading': !loading}))
        .then((response) => response)
        .catchError((error) {
      if (throwError) {
        throw Exception(error);
      } else {
        showErrorDialog(error as DioException);
        throw Exception(error);
      }
    });
  }

  Future<Response> post(
    String url,
    Map<String, dynamic> data, {
    bool loading = true,
    bool throwError = false,
  }) async {
    return _dio
        .post(
      url,
      data: data,
      options: Options(extra: {'withoutLoading': !loading}),
    )
        .catchError((error) {
      if (throwError) {
        throw Exception(error);
      } else {
        showErrorDialog(error as DioException);
        throw Exception(error);
      }
    });
  }

  Future<Response> patch(
    String url,
    Map<String, dynamic> data, {
    bool loading = true,
    bool throwError = false,
  }) async {
    return _dio
        .patch(
      url,
      data: data,
      options: Options(extra: {'withoutLoading': !loading}),
    )
        .catchError((error) {
      if (throwError) {
        throw Exception(error);
      } else {
        showErrorDialog(error as DioException);
        throw Exception(error);
      }
    });
  }
}
