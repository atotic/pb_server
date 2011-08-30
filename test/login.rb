require File.dirname(__FILE__) + '/helper'

class MyFirstTest < Test::Unit::TestCase
	
  def test_home
    get "/"
    follow_redirect! if last_response.redirect?
    assert last_response.ok?
  end
  
  def test_account 
  	# not logged in will be redirected
  	get '/account'
  	assert last_response.redirection?
  end
 
end

# rack/lib/rack/response/Helpers
#    def invalid?;       @status < 100 || @status >= 600;       end

#      def informational?; @status >= 100 && @status < 200;       end
#      def successful?;    @status >= 200 && @status < 300;       end
#      def redirection?;   @status >= 300 && @status < 400;       end
#      def client_error?;  @status >= 400 && @status < 500;       end
#      def server_error?;  @status >= 500 && @status < 600;       end

#      def ok?;            @status == 200;                        end
#      def forbidden?;     @status == 403;                        end
#     def not_found?;     @status == 404;                        end

 #     def redirect?;      [301, 302, 303, 307].include? @status; end
 #     def empty?;         [201, 204, 304].include?      @status; end