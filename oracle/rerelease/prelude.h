/* Force-included before id's rerelease game sources: MSVC's <cmath> puts isnan and isinf in the
 * global namespace as well, and the game calls them unqualified. */
#include <cmath>
using std::isinf;
using std::isnan;
